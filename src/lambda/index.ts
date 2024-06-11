import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Message } from '@line/bot-sdk/lib/types';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LINE_SIGNATURE_HTTP_HEADER_NAME, WebhookRequestBody, messagingApi, validateSignature } from '@line/bot-sdk';

// Systems manager から取得するための諸々
const ssmClient = new SSMClient();
const ssmGetChannelSecretCommand = new GetParameterCommand({
  Name: "/LineAccessInformation/CHANNEL_SECRET",
  WithDecryption: true,
});

const ssmGetAccessTokenCommand = new GetParameterCommand({
  Name: "/LineAccessInformation/ACCESS_TOKEN",
  WithDecryption: true,
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body ?? '');

  const [channelSecret, channelAccessToken] = await Promise.all([
    ssmClient.send(ssmGetChannelSecretCommand),
    ssmClient.send(ssmGetAccessTokenCommand),
  ]);

  // create LINE SDK client
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: channelAccessToken.Parameter!.Value ?? "",
  });

  // LINEからのリクエストの検証
  const signature = event.headers[LINE_SIGNATURE_HTTP_HEADER_NAME]
  if (!validateSignature(event.body!, channelSecret.Parameter?.Value ?? "", signature!)) {
    return {
      statusCode: 403,
      body: 'Invalid signature',
    };
  }

  // 文面の解析
  const bodyRequest: WebhookRequestBody = JSON.parse(event.body!);
  if (typeof bodyRequest.events[0] === "undefined") {
    // LINE Developer による Webhook の検証は events が空配列の body で来るのでその場合は 200 を返す
    return {
      statusCode: 200,
      body: "OK"
    }
  }

  if (bodyRequest.events[0].type !== "message" || bodyRequest.events[0].message.type !== "text") {
    return {
      statusCode: 500,
      body: 'Error',
    };
  } else {
    // 文面をそのままオウム返しする
    const messageReply: Message = {
      "type": "text",
      "text": bodyRequest.events[0].message.text
    }
    await client.replyMessage({ replyToken: bodyRequest.events[0].replyToken, messages: [messageReply] });
    // OK 返信をセット
    return {
      statusCode: 200,
      body: "OK"
    };
  }
};
