import { App } from 'aws-cdk-lib';

import { WebsiteStack } from '../stacks/WebsiteStack';

const CONSENT_DEMO_WEBSITE_SERVICE_NAME = 'consent-demo-website';
const SERVICE_TAG_NAME = 'service';
const STACK_TAG_NAME = 'stack';

export class ConsentManagementWebsiteApp extends App {
  constructor() {
    super();

    const websiteStack = new WebsiteStack(this, 'ConsentManagementWebsiteStack');
    websiteStack.addStackTag(SERVICE_TAG_NAME, CONSENT_DEMO_WEBSITE_SERVICE_NAME);
    websiteStack.addStackTag(STACK_TAG_NAME, websiteStack.stackName);
  }
}
