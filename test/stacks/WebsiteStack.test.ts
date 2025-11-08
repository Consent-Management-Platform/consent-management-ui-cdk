import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { AuthStack } from '../../lib/stacks/AuthStack';
import { WebsiteStack } from '../../lib/stacks/WebsiteStack';

describe('WebsiteStack', () => {
  // Normalize template attributes that change independently of CDK code changes
  function cleanDynamicResources(templateJson: any) {
    const CODE_KEY = 'Code';
    const CONTENT_KEY = 'Content';
    const METADATA_KEY = 'Metadata';
    const PROPERTIES_KEY = 'Properties';
    const RESOURCES_KEY = 'Resources';
    const S3KEY_KEY = 'S3Key';
    const SOURCE_OBJECT_KEYS_KEY = 'SourceObjectKeys';

    for (const resourceKey in templateJson[RESOURCES_KEY]) {
      if (resourceKey == 'WebsiteFrontendLambdaB76C5B1A' &&
          templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY][S3KEY_KEY];
      } else if (resourceKey.startsWith('WebsiteFrontendApiGatewayDeployment') &&
          templateJson[RESOURCES_KEY][resourceKey][METADATA_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][METADATA_KEY];
      } else if (resourceKey.startsWith('CustomCDKBucketDeployment') &&
          templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CODE_KEY][S3KEY_KEY];
      } else if (resourceKey.startsWith('DeployStaticWebsiteAssetsAwsCli')) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][CONTENT_KEY][S3KEY_KEY];
      } else if (resourceKey.startsWith('DeployStaticWebsiteAssetsCustomResource') &&
          templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][SOURCE_OBJECT_KEYS_KEY]) {
        delete templateJson[RESOURCES_KEY][resourceKey][PROPERTIES_KEY][SOURCE_OBJECT_KEYS_KEY];
      }
    }
  }

  it('creates the expected CloudFormation template from CDK', () => {
    const app = new App();
    const authStack = new AuthStack(app, 'AuthStack');
    const websiteStack = new WebsiteStack(app, 'WebsiteStack', {
      authClientId: authStack.authClientId,
      authUserPoolProviderUrl: authStack.authUserPoolProviderUrl,
    });
    const templateJson = Template.fromStack(websiteStack).toJSON();
    cleanDynamicResources(templateJson);
    expect(templateJson).toMatchSnapshot();
  });
});
