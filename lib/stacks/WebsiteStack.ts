import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { BehaviorOptions, CachePolicy, Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { RestApiOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ArnPrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

import { CFN_OUTPUT_API_GATEWAY_URL, CFN_OUTPUT_CLOUDFRONT_URL } from '../constants/cloudformationOutputs';
import { WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX } from '../constants/s3';

/**
 * Defines the website infrastructure.
 */
export class WebsiteStack extends Stack {
  private readonly lambdaRole: Role;
  private readonly staticAssetsBucket: Bucket;
  private readonly cloudFrontDistribution: Distribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Lambda function which hosts the web app
    this.lambdaRole = this.createLambdaRole();
    const lambdaFunction: Function = this.createLambdaFunction(this.lambdaRole);

    // API Gateway for Lambda integration
    const api: RestApi = this.createRestApiGateway(lambdaFunction);

    this.createCloudFormationOutputs(api);

    this.staticAssetsBucket= this.createStaticAssetsBucket();

    this.cloudFrontDistribution = this.createCloudFrontDistribution(api);

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
  private createLambdaFunction(lambdaRole: Role): Function {
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
      handler: 'run.sh',
      memorySize: 1024,
      role: lambdaRole,
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      // Environment variables used by AWS Lambda Adapter
      environment: {
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
}
