import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class LineParrotBot2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaParrotingBot = new NodejsFunction(this, 'LineParrotingBot', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/index.ts',
    });

    // API Gateway の作成
    const api = new apigateway.RestApi(this, 'LineParrotingApi', {
      restApiName: 'LineParrotingApi'
    });

    // proxy ありで API Gateway に渡すインテグレーションを作成
    const lambdaInteg = new apigateway.LambdaIntegration(
      lambdaParrotingBot, { proxy: true });
    // API Gateway の POST イベントと Lambda との紐付け
    api.root.addMethod('POST', lambdaInteg);

    // LambdaからSystems Managerのparameter storeを参照するための権限を付与
    const ssmChannelSecret = StringParameter.fromSecureStringParameterAttributes(this, "ssmChannelSecret", {
      parameterName: "/LineAccessInformation/CHANNEL_SECRET",
    });
    ssmChannelSecret.grantRead(lambdaParrotingBot);

    const ssmAccessToken = StringParameter.fromSecureStringParameterAttributes(this, "ssmAccessToken", {
      parameterName: "/LineAccessInformation/ACCESS_TOKEN",
    });
    ssmAccessToken.grantRead(lambdaParrotingBot);

  }
}
