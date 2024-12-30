import { App } from 'aws-cdk-lib';

import { WebsiteStack } from '../stacks/WebsiteStack';

export class ConsentManagementWebsiteApp extends App {
  constructor() {
    super();

    new WebsiteStack(this, 'ConsentManagementWebsiteStack');
  }
}
