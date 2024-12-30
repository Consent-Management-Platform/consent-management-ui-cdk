import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { WebsiteFrontendServiceStack } from '../../lib/stacks/WebsiteFrontendServiceStack';
import { WebsiteStaticAssetsStack } from '../../lib/stacks/WebsiteStaticAssetsStack';

describe('WebsiteStaticAssetsStack', () => {
  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const frontendStack = new WebsiteFrontendServiceStack(app, 'WebsiteFrontendServiceStack');
    const staticAssetsStack = new WebsiteStaticAssetsStack(app, 'WebsiteStaticAssetsStack', {
      lambdaRole: frontendStack.lambdaRole,
    });
    const template = Template.fromStack(staticAssetsStack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
