import { App, Stack } from 'aws-cdk-lib';

import { AuthStack } from '../stacks/AuthStack';
import { WebsiteStack } from '../stacks/WebsiteStack';

const CONSENT_DEMO_WEBSITE_SERVICE_NAME = 'consent-demo-website';
const SERVICE_TAG_NAME = 'service';

export class ConsentManagementWebsiteApp extends App {
  constructor() {
    super();

    const authStack = new AuthStack(this, 'ConsentManagementAuthStack');
    const websiteStack = new WebsiteStack(this, 'ConsentManagementWebsiteStack', {
      authClientId: authStack.authClientId,
      authUserPoolId: authStack.authUserPoolId,
      authUserPoolProviderUrl: authStack.authUserPoolProviderUrl,
    });

    const stacks: Stack[] = [authStack, websiteStack];
    stacks.forEach((stack) => {
      stack.addStackTag(SERVICE_TAG_NAME, CONSENT_DEMO_WEBSITE_SERVICE_NAME);
    });
  }
}
