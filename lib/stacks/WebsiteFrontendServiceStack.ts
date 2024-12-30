import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
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

    // IAM role for the frontend Lambda function
    this.lambdaRole = new Role(this, 'NextJsLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    this.lambdaRole.addToPolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX}-${this.account}/*`],
    }));

    // Lambda function for server-side rendering
    const lambdaFunction: Function = new Function(this, 'WebsiteFrontendLambda', {
      code: Code.fromAsset(path.join(__dirname, '../../../consent-management-ui/.next/standalone')),
      handler: 'index.handler',
      memorySize: 1024,
      role: this.lambdaRole,
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
    });

    // API Gateway for Lambda integration
    const api: RestApi = new LambdaRestApi(this, 'WebsiteFrontendApiGateway', {
      handler: lambdaFunction,
      proxy: false,
    });

    const apiResource = api.root.addResource('{proxy+}');
    apiResource.addMethod('ANY', new LambdaIntegration(lambdaFunction));

    this.createCloudFormationOutputs(api);
  }

  private createCloudFormationOutputs(api: RestApi): void {
    new CfnOutput(this, 'ApiGatewayURL', {
      description: 'Consent Management Website API Gateway URL',
      exportName: CFN_OUTPUT_API_GATEWAY_URL,
      value: api.url,
    });
  }
}
