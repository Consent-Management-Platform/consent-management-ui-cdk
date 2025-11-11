import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AccountRecovery, ClientAttributes, FeaturePlan, Mfa, StringAttribute, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Defines authentication infrastructure.
 */
export class AuthStack extends Stack {
  public readonly authClientId: string;
  public readonly authUserPoolId: string;
  public readonly authUserPoolProviderUrl: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const userPool = this.createCognitoUserPool();
    const userPoolClient = this.createCognitoUserPoolClient(userPool);
    this.authClientId = userPoolClient.userPoolClientId;
    this.authUserPoolId = userPool.userPoolId;
    this.authUserPoolProviderUrl = userPool.userPoolProviderUrl;
  }

  private createCognitoUserPool(): UserPool {
    return new UserPool(this, 'WebsiteUserPool', {
      accountRecovery: AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      customAttributes: {
        isAdmin: new StringAttribute({ mutable: true }),
      },
      featurePlan: FeaturePlan.ESSENTIALS,
      // Require multi-factor authentication for all users
      mfa: Mfa.REQUIRED,
      // Ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPool.html#mfamessage
      mfaMessage: 'This code will let you log into the Consent Management portal: {####}.',
      mfaSecondFactor: {
        // NOTE: Even though the CDK construct requires SMS to be enabled if OTP is enabled, in the website
        // code we only enable OTP since authenticator apps are preferred over SMS for security reasons.
        // We have not set up an SMS originator which incurs costs, or the SMS permissions, so SMS will not
        // work even if a user was allowed to select it.
        otp: true,
        sms: true
      },
      // Only allow users to be created by an admin or custom sign-up flow
      selfSignUpEnabled: false,
      // Allow passwordless login with email
      signInAliases: {
        email: true,
      },
      userPoolName: 'ConsentManagementUsers',
    });
  }

  private createCognitoUserPoolClient(userPool: UserPool): UserPoolClient {
    return new UserPoolClient(this, 'WebsiteUserPoolClient', {
      userPool,
      accessTokenValidity: Duration.minutes(15),
      authFlows: {
        // Enable passwordless choice-based auth (one-time passcodes)
        user: true,
        // Enable standard password auth flow
        userPassword: true,
        // Enable SRP (Secure Remote Password) auth flow
        userSrp: true,
      },
      authSessionValidity: Duration.minutes(15),
      enableTokenRevocation: true,
      idTokenValidity: Duration.hours(6),
      preventUserExistenceErrors: true,
      readAttributes: new ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          phoneNumber: true,
          phoneNumberVerified: true,
        })
        .withCustomAttributes('isAdmin'),
      writeAttributes: new ClientAttributes()
        .withStandardAttributes({
          email: true,
          phoneNumber: true,
        })
        .withCustomAttributes('isAdmin'),
    });
  }
}
