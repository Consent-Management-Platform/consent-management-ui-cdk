import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { WebsiteFrontendServiceStack } from '../../lib/stacks/WebsiteFrontendServiceStack';

describe('WebsiteFrontendServiceStack', () => {
  // Normalize template attributes that change independently of CDK code changes
  function cleanDynamicResources(templateJson: any) {
    const CODE_KEY = 'Code';
    const PROPERTIES_KEY = 'Properties';
    const RESOURCES_KEY = 'Resources';
    const S3KEY_KEY = 'S3Key';

    for (const resourceKey in templateJson[RESOURCES_KEY]) {
      if (resourceKey == 'WebsiteFrontendLambdaB76C5B1A' &&
          templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY][S3KEY_KEY];
      }
    }
  }

  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const stack = new WebsiteFrontendServiceStack(app, 'WebsiteFrontendServiceStack');

    const templateJson = Template.fromStack(stack).toJSON();
    cleanDynamicResources(templateJson);
    expect(templateJson).toMatchSnapshot();
  });
});
