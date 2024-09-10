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

const line_client = new LINEClient({
  storage: new FileStorage("./storage.json"),
  squareRateLimitter: new RateLimitter(4, 2000)
});

const line_target = {
  squareChatMid: "m45c50782d24820a6288b24f7a07365cc",
};

let discord_webhook: string | undefined = line_client.storage.get("discord_webhook") as string | undefined;

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

  const stampMetadata = (message.contentMetadata && message.contentMetadata["STKVER"]) ? message.contentMetadata["STKID"] : undefined;

  if (!discord_client.isReady || !discord_webhook) {
    return;
  }

  discord_client.channels.fetch(discord_target.channelId).then(async (channel) => {
    if (!channel) {
      return;
    }

    if (channel.type === ChannelType.GuildText) {
      const send = async (text: string) => {
        if (!discord_webhook) {
          return;
        }

        await fetch(discord_webhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            username: message.author.displayName,
            avatar_url: message.author.iconImage,
          }),
        })
      }
      console.log(message.contentMetadata)

      if (message.contentType === "STICKER" && stampMetadata) {
        await send(`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stampMetadata}/android/${message.contentMetadata["STKOPT"] === "A" ? "sticker_animation.png" : "sticker.png"}`)
      }else if ((message.contentType === "IMAGE" || message.contentType === "VIDEO" || message.contentType === "FILE") && message.data) {
        const obsData = await line_client.getMessageObsData(message.squareMessage.message.id);

        const response = await fetch("https://storage.evex.land/upload?filename=" + encodeURIComponent(message.contentMetadata["FILE_NAME"] || `image.${JSON.parse(message.contentMetadata["MEDIA_CONTENT_INFO"])["extension"] || "png"}`), {
          method: "POST",
          body: obsData,
        })

        if (response.ok) {
          const obsDataUrl = (await response.json()).downloadKey;

          if (obsDataUrl) {
            await send(`https://storage.evex.land/download?key=${encodeURIComponent(obsDataUrl)}`);
          }
        }
      }else if (message.content !== "") {
        await send(message.content.replace("@everyone", "@ everyone").replace("@here", "@ here"));
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
  channelId: "1280752398968815728",
};

discord_client.on("ready", () => {
  console.log("[Discord] Ready");

  if (discord_webhook) return;

  discord_client.channels.fetch(discord_target.channelId).then(async (channel) => {
    if (!channel) {
      return;
    }

    if (channel.type === ChannelType.GuildText) {
      discord_webhook = (await channel.createWebhook({
        name: "Linecord - Webhook"
      })).url;

      line_client.storage.set("discord_webhook", discord_webhook);
    }
  })
});

discord_client.login(DISCORD_TOKEN);
