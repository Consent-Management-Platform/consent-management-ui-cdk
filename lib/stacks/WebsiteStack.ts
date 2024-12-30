import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { WebsiteFrontendServiceStack } from './WebsiteFrontendServiceStack';
import { WebsiteStaticAssetsStack } from './WebsiteStaticAssetsStack';

/**
 * The main stack that defines the website infrastructure.
 *
 * Contains nested child stacks for the frontend service and static assets.
 */
export class WebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const frontendServiceStack = new WebsiteFrontendServiceStack(this, 'WebsiteFrontendServiceStack');
    new WebsiteStaticAssetsStack(this, 'WebsiteStaticAssetsStack', {
      lambdaRole: frontendServiceStack.lambdaRole,
    });
  }
}
