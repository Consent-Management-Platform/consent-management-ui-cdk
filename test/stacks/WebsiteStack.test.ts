import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { WebsiteStack } from '../../lib/stacks/WebsiteStack';

describe('WebsiteStack', () => {
  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const stack = new WebsiteStack(app, 'WebsiteStack');
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
