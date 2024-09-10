import "@std/dotenv/load";

const {
  DISCORD_TOKEN,
  LINE_EMAIL,
  LINE_PASSWORD,
  LINE_AUTHTOKEN,
} = Deno.env.toObject();

if (!DISCORD_TOKEN || !LINE_EMAIL || !LINE_PASSWORD) {
  throw new Error("Missing environment variables");
}

import { Client as LINEClient } from "@evex/linejs";
import { FileStorage } from "@evex/linejs/storage";
import { ChannelType, Client as DiscordClient } from "@djs/client";
import { RateLimitter } from "@evex/linejs/rate-limit";
import { LINE_OBS } from "@evex/linejs/utils";

const line_client = new LINEClient({
  storage: new FileStorage("./storage.json"),
  squareRateLimitter: new RateLimitter(4, 2000)
});

const line_obs = new LINE_OBS();

const line_target = {
  squareChatMid: "m45c50782d24820a6288b24f7a07365cc",
};

let discord_webhook: string | undefined;

line_client.on("ready", (user) => {
  console.log("[LINE] Ready: ", `As ${user.displayName} (${user.mid})`);
})

line_client.on("pincall", (pincode) => {
  console.log("[LINE] Pincode: ", pincode);
});

line_client.on("update:authtoken", (authtoken) => {
  console.log("[LINE] Auth token updated: ", authtoken);
});

line_client.on("square:message", (message) => {
  if (message.squareChatMid !== line_target.squareChatMid) {
    return;
  }

  const stampMetadata = "STKVER" in message.contentMetadata ? message.contentMetadata["STKID"] : undefined;

  if (!discord_client.isReady || !discord_webhook) {
    return;
  }

  discord_client.channels.fetch(discord_target.channelId).then((channel) => {
    if (!channel) {
      return;
    }

    if (channel.type === ChannelType.GuildText) {
      const send = (text: string) => {
        if (!discord_webhook) {
          return;
        }

        fetch(discord_webhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            name: message.author.displayName,
            avatar: message.author.iconImage,
          }),
        })
      }

      if (message.contentType === "STICKER" && stampMetadata) {
        send(`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stampMetadata}/android/sticker.png`)
      }else if ((message.contentType === "IMAGE" || message.contentType === "VIDEO") && message.data) {
        const obsDataUrl = line_obs.getDataUrl(message.squareMessage.message.id)

        if (obsDataUrl) {
          send(obsDataUrl);
        }
      }else if (message.contentType === "FILE" && message.data) {
        const obsDataUrl = line_obs.getDataUrl(message.squareMessage.message.id)

        if (obsDataUrl) {
          send(obsDataUrl);
        }
      }else if (message.content !== "") {
        send(message.content);
      }
    }
  })
});

line_client.login({
  email: LINE_EMAIL,
  password: LINE_PASSWORD,
  authToken: LINE_AUTHTOKEN || undefined,
});

const discord_client = new DiscordClient({
  intents: [
    "Guilds",
    "GuildMessages",
    "GuildMessageReactions",
    "GuildWebhooks",
    "MessageContent",
  ],
});

const discord_target = {
  serverId: "1255359848644608035",
  channelId: "1255362057709289493",
};

discord_client.on("ready", () => {
  console.log("[Discord] Ready");

  discord_client.channels.fetch(discord_target.channelId).then(async (channel) => {
    if (!channel) {
      return;
    }

    if (channel.type === ChannelType.GuildText) {
      discord_webhook = (await channel.createWebhook({
        name: "Linecord - Webhook"
      })).url;
    }
  })
});

discord_client.login(DISCORD_TOKEN);
