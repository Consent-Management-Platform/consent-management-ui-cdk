import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { AuthStack } from '../../lib/stacks/AuthStack';

describe('AuthStack', () => {
  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const stack = new AuthStack(app, 'AuthStack');
    const templateJson = Template.fromStack(stack).toJSON();
    expect(templateJson).toMatchSnapshot();
  });
});
