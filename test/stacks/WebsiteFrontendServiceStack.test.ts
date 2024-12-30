import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { WebsiteFrontendServiceStack } from '../../lib/stacks/WebsiteFrontendServiceStack';

describe('WebsiteFrontendServiceStack', () => {
  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const stack = new WebsiteFrontendServiceStack(app, 'WebsiteFrontendServiceStack');
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
