# consent-management-ui-cdk

This package defines the AWS infrastructure for the [Demo Consent Management UI](https://github.com/Consent-Management-Platform/consent-management-ui), using the AWS Cloud Development Kit (CDK).

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy STACK_NAME_HERE`  deploy the given stack to your default AWS account/region
  * eg. `npx cdk deploy ConsentManagementWebsiteStack/WebsiteFrontendServiceStack` to deploy just the frontend stack
  * eg. `npx cdk deploy ConsentManagementWebsiteStack/WebsiteStaticAssetsStack` to deploy the static assets stack and other stacks it has explicit dependencies on
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Deploying stacks to a dev account

```sh
npm run test && \
  npx cdk synth && \
  npx cdk deploy ConsentManagementWebsiteStack && \
  npx cdk deploy ConsentManagementWebsiteStack/WebsiteStaticAssetsStack
```

Since ConsentManagementWebsiteStack/WebsiteStaticAssetsStack has explicit dependencies on ConsentManagementWebsiteStack/WebsiteFrontendServiceStack, this will automatically deploy both stacks under the parent stack ConsentManagementWebsiteStack.

Just running `npx cdk deploy ConsentManagementWebsiteStack` does not deploy both child stacks, it only deploys the empty parent stack with CDK metadata.
