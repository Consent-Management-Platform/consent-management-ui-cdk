import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { BehaviorOptions, CachePolicy, Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { RestApiOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ArnPrincipal, ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { AwsCustomResource, AwsCustomResourcePolicy } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'path';

import { CFN_OUTPUT_API_GATEWAY_URL, CFN_OUTPUT_CLOUDFRONT_URL } from '../constants/cloudformationOutputs';
import { WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX } from '../constants/s3';

export interface WebsiteStackProps extends StackProps {
  authClientId: string;
  authUserPoolProviderUrl: string;
}

/**
 * Defines the website infrastructure.
 */
export class WebsiteStack extends Stack {
  private readonly lambdaRole: Role;
  private readonly staticAssetsBucket: Bucket;
  private readonly cloudFrontDistribution: Distribution;

  constructor(scope: Construct, id: string, readonly props: WebsiteStackProps) {
    super(scope, id, props);

    // Lambda function which hosts the web app
    this.lambdaRole = this.createLambdaRole();
    const lambdaFunction: Function = this.createLambdaFunction(this.lambdaRole, {
      AUTH_CLIENT_ID: this.props.authClientId,
      AUTH_USER_POOL_PROVIDER_URL: this.props.authUserPoolProviderUrl,
      // Will be automatically updated after CloudFront distribution is created
      WEBSITE_DOMAIN_NAME: 'PLACEHOLDER',
    });

    // API Gateway for Lambda integration
    const api: RestApi = this.createRestApiGateway(lambdaFunction);

    this.createCloudFormationOutputs(api);

    this.staticAssetsBucket= this.createStaticAssetsBucket();

    this.cloudFrontDistribution = this.createCloudFrontDistribution(api);

    // Update the environment variable of the API Lambda
    this.updateWebsiteDomainNameEnvVar(lambdaFunction, this.cloudFrontDistribution);

    // Deploy static assets from the Next.js app to the S3 bucket
    new BucketDeployment(this, 'DeployStaticWebsiteAssets', {
      sources: [Source.asset('../consent-management-ui/.next/static')],
      destinationBucket: this.staticAssetsBucket,
      destinationKeyPrefix: '_next/static',
      distribution: this.cloudFrontDistribution,
      distributionPaths: ['/_next/static/*'],
      memoryLimit: 1024,
    });
  }

  // Creates IAM role for the frontend Lambda function
  private createLambdaRole(): Role {
    const lambdaRole: Role = new Role(this, 'NextJsLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    lambdaRole.addToPolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX}-${this.account}/*`],
    }));
    return lambdaRole;
  }

  // Creates the Lambda function that hosts the web app service code
  private createLambdaFunction(lambdaRole: Role, customEnv: { [key: string]: string }): Function {
    // The AWS Lambda Adapter layer is used to run web apps in AWS Lambda.
    // Ref: https://github.com/awslabs/aws-lambda-web-adapter
    const lambdaAdapterLayer = LayerVersion.fromLayerVersionArn(
      this,
      'LambdaWebAdapterLayer',
      `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:25`
    );

    return new Function(this, 'WebsiteFrontendLambda', {
      architecture: Architecture.ARM_64,
      code: Code.fromAsset(path.join(__dirname, '../../../consent-management-ui/.next/standalone')),
      functionName: 'ConsentWebsiteFrontend',
      handler: 'run.sh',
      memorySize: 1024,
      role: lambdaRole,
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      // Environment variables used by AWS Lambda Adapter
      environment: {
        ...customEnv,
        'AWS_LAMBDA_EXEC_WRAPPER': '/opt/bootstrap',
        'RUST_LOG': 'info',
        'PORT': '8080',
      },
      layers: [lambdaAdapterLayer],
    });
  }

  // Creates API Gateway for the web app
  private createRestApiGateway(lambdaFunction: Function): RestApi {
    const api: RestApi = new LambdaRestApi(this, 'WebsiteFrontendApiGateway', {
      handler: lambdaFunction,
      proxy: false,
      deployOptions: {
        // By default, limit incoming traffic to 5 requests/second
        throttlingRateLimit: 5,
        // Allow bursts of up to 10 requests/second
        throttlingBurstLimit: 10,
      },
    });

    const lambdaIntegration = new LambdaIntegration(lambdaFunction);
    // Pass base '/' path requests to the Lambda function
    api.root.addMethod('ANY', lambdaIntegration);
    // Pass requests to all other paths to the Lambda function
    const apiResource = api.root.addResource('{proxy+}');
    apiResource.addMethod('ANY', lambdaIntegration);
    // Handle CORS preflight requests
    apiResource.addMethod('OPTIONS');
    return api;
  }

  // Creates CloudFormation Outputs for other stacks to reference
  private createCloudFormationOutputs(api: RestApi): void {
    new CfnOutput(this, 'ApiGatewayURL', {
      description: 'Consent Management Website API Gateway URL',
      exportName: CFN_OUTPUT_API_GATEWAY_URL,
      value: api.url,
    });
  }

  private createStaticAssetsBucket(): Bucket {
    const staticAssetsBucket: Bucket = new Bucket(this, 'ConsentManagementWebsiteStaticAssetsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      bucketName: `${WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX}-${this.account}`,
    });

    // Add bucket policy to allow the website's Lambda function to access the bucket
    staticAssetsBucket.addToResourcePolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [staticAssetsBucket.arnForObjects('*')],
      principals: [new ArnPrincipal(this.lambdaRole.roleArn)],
    }));

    return staticAssetsBucket;
  }

  private createCloudFrontDistribution(api: RestApi): Distribution {
    const staticAssetsBehaviour: BehaviorOptions = {
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      origin: S3BucketOrigin.withOriginAccessControl(this.staticAssetsBucket),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    };

    const cloudFrontDistribution = new Distribution(this, 'WebsiteCloudFrontDistribution', {
      defaultBehavior: {
        cachePolicy: CachePolicy.CACHING_DISABLED,
        origin: new RestApiOrigin(api),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/_next/static/*': staticAssetsBehaviour,
        'static/*': staticAssetsBehaviour,
      },
    });

    // Output the CloudFront distribution URL to enable use by other stacks
    new CfnOutput(this, 'CloudFrontURL', {
      exportName: CFN_OUTPUT_CLOUDFRONT_URL,
      value: cloudFrontDistribution.distributionDomainName,
    });

    return cloudFrontDistribution;
  }

  /**
   * To resolve circular dependency issues between the website's backend Lambda function
   * CloudFront distribution that depends on it, we use a custom resource to update
   * the Lambda's env vars to pass in the CloudFront domain name after creation.
   *
   * This allows CDK deployments without manual intervention, with the downside of
   * temporary website unavailability until the update is complete.
   *
   * If productionalizing the website, would replace this with a more robust solution such
   * as defining (and paying for) a custom domain name before the Lambda or CloudFront
   * distribution and passing the domain name into both resources.
   */
  private updateWebsiteDomainNameEnvVar(lambdaFunction: Function, cloudFrontDistribution: Distribution): void {
    const updateLambdaEnvLambda = new Function(this, 'UpdateLambdaEnvLambda', {
      architecture: Architecture.ARM_64,
      code: Code.fromInline(`
        const AWS = require('aws-sdk');
        const lambda = new AWS.Lambda();

        exports.handler = async (event) => {
          const functionName = event.ResourceProperties.FunctionName;
          const cloudFrontDomainName = event.ResourceProperties.CloudFrontDomainName;

          try {
            // Get the current environment variables
            const config = await lambda.getFunctionConfiguration({ FunctionName: functionName }).promise();
            const environment = config.Environment || { Variables: {} };

            // Update the environment variables
            environment.Variables['WEBSITE_DOMAIN_NAME'] = cloudFrontDomainName;

            // Update the Lambda function configuration
            await lambda.updateFunctionConfiguration({
              FunctionName: functionName,
              Environment: environment,
            }).promise();

            return { PhysicalResourceId: functionName };
          } catch (error) {
            console.error(error);
            throw error;
          }
        };
      `),
      functionName: 'FrontendLambdaEnvUpdater',
      handler: 'index.handler',
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.minutes(3),
    });

    // Grant permissions to the Lambda function to update the API Lambda's configuration
    updateLambdaEnvLambda.addToRolePolicy(new PolicyStatement({
      actions: ['lambda:GetFunctionConfiguration', 'lambda:UpdateFunctionConfiguration'],
      resources: [lambdaFunction.functionArn],
    }));

    // Custom resource to update the API Lambda's environment variable
    const updateLambdaEnvCustomResource = new AwsCustomResource(this, 'UpdateLambdaEnvCustomResource', {
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: updateLambdaEnvLambda.functionName,
          Payload: JSON.stringify({
            ResourceProperties: {
              FunctionName: lambdaFunction.functionName,
              CloudFrontDomainName: cloudFrontDistribution.domainName,
            },
          }),
        },
        physicalResourceId: { id: lambdaFunction.functionName },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          lambdaFunction.functionArn,
        ],
      }),
    });

    // Grant the custom resource's role permission to invoke your Lambda
    updateLambdaEnvLambda.grantInvoke(updateLambdaEnvCustomResource);
  }
}
