import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

import { CFN_OUTPUT_API_GATEWAY_URL } from '../constants/cloudformationOutputs';
import { WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX } from '../constants/s3';

/**
* Defines AWS infrastructure for the Demo Consent Management UI's frontend service.
*/
export class WebsiteFrontendServiceStack extends Stack {
  public readonly lambdaRole: Role;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Lambda function which hosts the web app
    this.lambdaRole = this.createLambdaRole();
    const lambdaFunction: Function = this.createLambdaFunction(this.lambdaRole);

    // API Gateway for Lambda integration
    const api: RestApi = this.createRestApiGateway(lambdaFunction);

    this.createCloudFormationOutputs(api);
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
  private createRestApiGateway(lambdaFunction: Function) {
    const api: RestApi = new LambdaRestApi(this, 'WebsiteFrontendApiGateway', {
      handler: lambdaFunction,
      proxy: false,
    });

    const apiResource = api.root.addResource('{proxy+}');
    apiResource.addMethod('ANY', new LambdaIntegration(lambdaFunction));
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
}
