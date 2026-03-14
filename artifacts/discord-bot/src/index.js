import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ROLE_ID = process.env.DISCORD_ROLE_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN || !GUILD_ID || !ROLE_ID || !CHANNEL_ID) {
  console.error("Missing required environment variables!");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const VERIFY_BUTTON_ID = "verify_member";

function buildVerifyEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🏫 ยืนยันสมาชิก | สภานักเรียน")
    .setDescription(
      "กดปุ่ม **ยืนยัน** ด้านล่างเพื่อรับยศสมาชิกของเซิร์ฟเวอร์\n\n" +
        "หลังจากกดปุ่มแล้ว คุณจะได้รับยศโดยอัตโนมัติทันที ✅"
    )
    .setFooter({ text: "สภานักเรียน | ระบบยืนยันสมาชิก" })
    .setTimestamp();
}

function buildVerifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel("✅ ยืนยันสมาชิก")
      .setStyle(ButtonStyle.Success)
  );
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("ส่งข้อความยืนยันสมาชิกไปยังช่องที่กำหนด (แอดมินเท่านั้น)")
      .toJSON(),
  ];

  const rest = new REST().setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
  console.log("ลงทะเบียน slash commands เรียบร้อย");
}

async function sendVerifyMessage(channel) {
  await channel.send({
    embeds: [buildVerifyEmbed()],
    components: [buildVerifyRow()],
  });
  console.log(`ส่งข้อความยืนยันไปยังช่อง #${channel.name} แล้ว`);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`บอทพร้อมใช้งาน! เข้าสู่ระบบในชื่อ ${readyClient.user.tag}`);

  await registerCommands();

  try {
    const channel = await readyClient.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error(`ไม่พบช่อง ID: ${CHANNEL_ID}`);
      return;
    }

    const messages = await channel.messages.fetch({ limit: 50 });
    const existingBotMsg = messages.find(
      (m) => m.author.id === readyClient.user.id && m.components.length > 0
    );

    if (existingBotMsg) {
      console.log("พบข้อความยืนยันในช่องแล้ว — ใช้ /setup เพื่อส่งใหม่");
    } else {
      await sendVerifyMessage(channel);
    }
  } catch (err) {
    console.error("เกิดข้อผิดพลาดตอนเริ่มต้น:", err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await sendVerifyMessage(channel);
      await interaction.editReply({
        content: `✅ ส่งข้อความยืนยันไปยัง <#${CHANNEL_ID}> เรียบร้อยแล้ว!`,
      });
    } catch (err) {
      await interaction.editReply({
        content: "❌ เกิดข้อผิดพลาด: " + err.message,
      });
    }
    return;
  }

  if (!interaction.isButton()) return;
  if (interaction.customId !== VERIFY_BUTTON_ID) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const member = interaction.member;

    if (member.roles.cache.has(ROLE_ID)) {
      await interaction.editReply({
        content: "✅ คุณได้รับยศสมาชิกไปแล้ว!",
      });
      return;
    }

    await member.roles.add(ROLE_ID);

    await interaction.editReply({
      content: "🎉 ยืนยันสำเร็จ! คุณได้รับยศสมาชิกของสภานักเรียนแล้ว ยินดีต้อนรับ!",
    });

    console.log(`ให้ยศสมาชิกกับ ${interaction.user.tag} (${interaction.user.id}) แล้ว`);
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการให้ยศ:", error);
    await interaction.editReply({
      content: "❌ เกิดข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ\n`" + error.message + "`",
    });
  }
});

client.login(TOKEN);
