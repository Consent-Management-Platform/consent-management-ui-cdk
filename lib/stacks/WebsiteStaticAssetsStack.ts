import { CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { BehaviorOptions, CachePolicy, Distribution, OriginRequestPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

import { WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX } from '../constants/s3';
import { CFN_OUTPUT_API_GATEWAY_URL, CFN_OUTPUT_CLOUDFRONT_URL } from '../constants/cloudformationOutputs';
import { ArnPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';

interface WebsiteStaticAssetsStackProps extends StackProps {
  lambdaRole: Role;
}

/**
 * Defines AWS infrastructure for the Demo Consent Management UI website's static assets.
 */
export class WebsiteStaticAssetsStack extends Stack {
  public readonly staticAssetsBucket: Bucket;
  private readonly cloudFrontDistribution: Distribution;

  constructor(scope: Construct, id: string, readonly props: WebsiteStaticAssetsStackProps) {
    super(scope, id, props);

    this.staticAssetsBucket= this.createStaticAssetsBucket();

    this.cloudFrontDistribution = this.createCloudFrontDistribution();

    // Deploy static assets from the Next.js app to the S3 bucket
    new BucketDeployment(this, 'DeployStaticWebsiteAssets', {
      sources: [Source.asset('../consent-management-ui/.next/static')],
      destinationBucket: this.staticAssetsBucket,
      distribution: this.cloudFrontDistribution,
      distributionPaths: ['/*'],
    });
  }

  private createStaticAssetsBucket(): Bucket {
    const staticAssetsBucket: Bucket = new Bucket(this, 'ConsentManagementWebsiteStaticAssetsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      bucketName: `${WEBSITE_STATIC_ASSETS_BUCKET_NAME_PREFIX}-${this.account}`,
      websiteIndexDocument: 'index.html',
    });

    // Add bucket policy to allow the website's Lambda function to access the bucket
    staticAssetsBucket.addToResourcePolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [staticAssetsBucket.arnForObjects('*')],
      principals: [new ArnPrincipal(this.props.lambdaRole.roleArn)],
    }));

    return staticAssetsBucket;
  }

  private createCloudFrontDistribution(): Distribution {
    const staticAssetsBehaviour: BehaviorOptions = {
      origin: S3BucketOrigin.withOriginAccessControl(this.staticAssetsBucket),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    };

    const apiUrl = Fn.importValue(CFN_OUTPUT_API_GATEWAY_URL);
    // Directly using the API Gateway URL results in a
    // "Invalid request provided: AWS::CloudFront::Distribution: The parameter origin name cannot contain a colon."
    // error, so we need to extract the domain name from the URL.
    // Ref: https://stackoverflow.com/a/72010828
    const parsedApiUrl = Fn.select(2, Fn.split('/', apiUrl));

    const cloudFrontDistribution = new Distribution(this, 'WebsiteCloudFrontDistribution', {
      defaultBehavior: staticAssetsBehaviour,
      additionalBehaviors: {
        '/_next/*': staticAssetsBehaviour,
        'api/*': {
          origin: new HttpOrigin(parsedApiUrl),
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        }
      },
    });

    // Output the CloudFront distribution URL to enable use by other stacks
    new CfnOutput(this, 'CloudFrontURL', {
      exportName: CFN_OUTPUT_CLOUDFRONT_URL,
      value: cloudFrontDistribution.distributionDomainName,
    });

    return cloudFrontDistribution;
  }
}
