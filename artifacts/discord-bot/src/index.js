import express from "express";
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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ROLE_ID = process.env.DISCORD_ROLE_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const API_URL = process.env.API_URL || "http://localhost:8080";

if (!TOKEN || !GUILD_ID || !ROLE_ID || !CHANNEL_ID) {
  console.error("Missing required environment variables!");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const VERIFY_BUTTON_ID = "verify_member";
const VERIFY_MODAL_ID = "verify_modal";
const STUDENT_ID_INPUT = "student_id_input";
const PASSWORD_INPUT = "password_input";

function buildVerifyEmbed() {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🏫 ระบบยืนยันสมาชิก | สภานักเรียน")
    .setDescription(
      "━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "ยินดีต้อนรับสู่เซิร์ฟเวอร์ **สภานักเรียน** 👋\n" +
      "กรุณายืนยันตัวตนด้วยรหัสนักเรียนของคุณเพื่อเข้าถึงช่องทั้งหมดในเซิร์ฟเวอร์\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━"
    )
    .addFields(
      {
        name: "📋 วิธีการยืนยันตัวตน",
        value:
          "**ขั้นตอนที่ 1** — กดปุ่ม **✅ ยืนยันตัวตน** ด้านล่าง\n" +
          "**ขั้นตอนที่ 2** — กรอก **รหัสประจำตัวนักเรียน** ของคุณ\n" +
          "**ขั้นตอนที่ 3** — กรอก **รหัสผ่าน** ที่ได้รับจากสภานักเรียน\n" +
          "**ขั้นตอนที่ 4** — กด **Submit** รอรับยศสมาชิกได้เลย!",
        inline: false,
      },
      {
        name: "✅ มีบัญชีในระบบแล้ว",
        value: "กดปุ่มยืนยันและกรอกข้อมูลได้เลย จะได้รับยศสมาชิกทันที",
        inline: true,
      },
      {
        name: "❌ ยังไม่มีบัญชี",
        value: "กรุณาลงทะเบียนในเว็บไซต์ของสภานักเรียนให้เรียบร้อยก่อน แล้วค่อยกลับมายืนยันตัวตน",
        inline: true,
      },
      {
        name: "⚠️ หมายเหตุ",
        value:
          "• รหัสนักเรียนและรหัสผ่านจะถูกเก็บเป็นความลับ\n" +
          "• 1 บัญชีนักเรียน ผูกได้กับ 1 บัญชี Discord เท่านั้น\n" +
          "• หากพบปัญหา กรุณาติดต่อแอดมิน",
        inline: false,
      }
    )
    .setFooter({ text: "สภานักเรียน | ระบบยืนยันสมาชิก • หากมีปัญหาติดต่อแอดมิน" })
    .setTimestamp();
}

function buildVerifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel("✅ ยืนยันตัวตน")
      .setStyle(ButtonStyle.Success)
  );
}

function buildVerifyModal() {
  const modal = new ModalBuilder()
    .setCustomId(VERIFY_MODAL_ID)
    .setTitle("เข้าสู่ระบบ สภานักเรียน");

  const studentIdInput = new TextInputBuilder()
    .setCustomId(STUDENT_ID_INPUT)
    .setLabel("รหัสประจำตัวนักเรียน")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น 12345")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(20);

  const passwordInput = new TextInputBuilder()
    .setCustomId(PASSWORD_INPUT)
    .setLabel("รหัสผ่าน")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("รหัสผ่านของคุณ")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(studentIdInput),
    new ActionRowBuilder().addComponents(passwordInput)
  );

  return modal;
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("ส่งข้อความยืนยันสมาชิกไปยังช่องที่กำหนด (แอดมินเท่านั้น)")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("addstudent")
      .setDescription("เพิ่มนักเรียนในระบบ (แอดมินเท่านั้น)")
      .addStringOption((opt) =>
        opt.setName("student_id").setDescription("รหัสนักเรียน").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("password").setDescription("รหัสผ่าน").setRequired(true)
      )
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
  // /setup command
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    await interaction.deferReply({ flags: 64 });
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await sendVerifyMessage(channel);
      await interaction.editReply({
        content: `✅ ส่งข้อความยืนยันไปยัง <#${CHANNEL_ID}> เรียบร้อยแล้ว!`,
      });
    } catch (err) {
      await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด: " + err.message });
    }
    return;
  }

  // /addstudent command
  if (interaction.isChatInputCommand() && interaction.commandName === "addstudent") {
    await interaction.deferReply({ flags: 64 });
    const studentId = interaction.options.getString("student_id");
    const password = interaction.options.getString("password");

    try {
      const res = await fetch(`${API_URL}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        await interaction.editReply({ content: `❌ ${data.error}` });
      } else {
        await interaction.editReply({
          content: `✅ เพิ่มนักเรียนรหัส **${studentId}** เรียบร้อยแล้ว!`,
        });
      }
    } catch (err) {
      await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด: " + err.message });
    }
    return;
  }

  // Verify button → show modal
  if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) {
    await interaction.showModal(buildVerifyModal());
    return;
  }

  // Modal submitted
  if (interaction.isModalSubmit() && interaction.customId === VERIFY_MODAL_ID) {
    await interaction.deferReply({ flags: 64 });

    const studentId = interaction.fields.getTextInputValue(STUDENT_ID_INPUT);
    const password = interaction.fields.getTextInputValue(PASSWORD_INPUT);
    const discordUserId = interaction.user.id;

    try {
      const res = await fetch(`${API_URL}/api/students/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          password,
          discord_user_id: discordUserId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        await interaction.editReply({ content: `❌ ${data.error}` });
        return;
      }

      // Assign role
      const member = interaction.member;
      if (member.roles.cache.has(ROLE_ID)) {
        await interaction.editReply({ content: "✅ คุณได้รับยศสมาชิกไปแล้ว!" });
        return;
      }

      await member.roles.add(ROLE_ID);
      await interaction.editReply({
        content: `🎉 ยืนยันสำเร็จ! ยินดีต้อนรับสู่เซิร์ฟเวอร์สภานักเรียน คุณได้รับยศสมาชิกแล้ว!`,
      });

      console.log(`ให้ยศสมาชิกกับ ${interaction.user.tag} (รหัส ${studentId}) แล้ว`);
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    }
    return;
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

const startTime = new Date();

app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>สภานักเรียน — Bot Dashboard</title>
      <style>
        body { font-family: sans-serif; background: #1a1a2e; color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #16213e; border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 4px 30px rgba(0,0,0,0.4); }
        .status { font-size: 48px; margin-bottom: 16px; }
        h1 { color: #2ecc71; margin: 0 0 8px; font-size: 24px; }
        p { color: #aaa; margin: 4px 0; }
        .badge { display: inline-block; background: #2ecc71; color: #000; border-radius: 20px; padding: 4px 16px; font-weight: bold; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status">🤖</div>
        <h1>สภานักเรียน Bot</h1>
        <p>สถานะ: <strong style="color:#2ecc71">Online</strong></p>
        <p>Uptime: <strong>${hours}h ${minutes}m ${seconds}s</strong></p>
        <p>เวลาเริ่มต้น: <strong>${startTime.toLocaleString("th-TH")}</strong></p>
        <div class="badge">✅ Bot กำลังทำงาน</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Dashboard พร้อมใช้งานที่ port ${PORT}`);
});

client.login(TOKEN);
