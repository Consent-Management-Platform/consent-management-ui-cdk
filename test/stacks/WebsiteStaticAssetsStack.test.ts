import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { WebsiteFrontendServiceStack } from '../../lib/stacks/WebsiteFrontendServiceStack';
import { WebsiteStaticAssetsStack } from '../../lib/stacks/WebsiteStaticAssetsStack';

describe('WebsiteStaticAssetsStack', () => {
  // Normalize template attributes that change independently of CDK code changes
  function cleanDynamicResources(templateJson: any) {
    const CODE_KEY = 'Code';
    const CONTENT_KEY = 'Content';
    const PROPERTIES_KEY = 'Properties';
    const RESOURCES_KEY = 'Resources';
    const S3KEY_KEY = 'S3Key';

    // Normalize S3Key values that change independently of CDK code changes
    for (const resourceKey in templateJson[RESOURCES_KEY]) {
      if (resourceKey.startsWith('CustomCDKBucketDeployment') &&
          templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY][S3KEY_KEY];
      } else if (resourceKey.startsWith('DeployStaticWebsiteAssetsAwsCli')) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CONTENT_KEY][S3KEY_KEY];
      }
    }
  }

  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const frontendStack = new WebsiteFrontendServiceStack(app, 'WebsiteFrontendServiceStack');
    const staticAssetsStack = new WebsiteStaticAssetsStack(app, 'WebsiteStaticAssetsStack', {
      lambdaRole: frontendStack.lambdaRole,
    });
    const templateJson = Template.fromStack(staticAssetsStack).toJSON();
    cleanDynamicResources(templateJson);
    expect(templateJson).toMatchSnapshot();
  });
});
