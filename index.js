/**
 * Telegram Shop Bot
 * - Đọc sản phẩm từ JSONBin
 * - Khách chọn sản phẩm → chọn loại → hiện VietQR
 * - Nút "Đã thanh toán" → chờ admin duyệt trên admin.html
 */

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

// ============ CONFIG ============
const BOT_TOKEN = process.env.BOT_TOKEN || '9131951452:AAF5vKlpd4fZQd94ww6KEABiHJiT-gBKDAs';
const BIN_ID = process.env.BIN_ID || '6b041f24ffd5d16053d776ed';
const MASTER_KEY = process.env.MASTER_KEY || '$2a$10$E3TfVjjxGA2Dy1881YzVOO.kjLRnQigWfUWmK5vj3Ny8h2gCbTl9e';

// Ngân hàng
const BANK_BIN = '970454'; // Bản Việt
const BANK_ACCOUNT = '99ZP26154M42407211';
const BANK_NAME = 'ZALOPAY_PHAM THI HUE';

// Admin chat ID (sẽ tự cập nhật khi bạn gửi /setadmin)
let ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || null;

const API = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// ============ BOT ============
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('Bot đang chạy...');

// ============ JSONBIN HELPERS ============
async function getData() {
  const res = await fetch(API + '/latest', {
    headers: { 'X-Master-Key': MASTER_KEY }
  });
  if (!res.ok) throw new Error('Không đọc được JSONBin');
  const json = await res.json();
  const data = json.record || { products: [], orders: [] };
  if (!data.products) data.products = [];
  if (!data.orders) data.orders = [];
  return data;
}

async function saveData(data) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': MASTER_KEY,
      'X-Bin-Versioning': 'false'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Không lưu được JSONBin');
  return true;
}

// ============ UTILS ============
function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function makeOrderId() {
  return 'DH' + Date.now().toString().slice(-8);
}

function vietQRUrl(amount, addInfo) {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: addInfo,
    accountName: BANK_NAME
  });
  return `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact2.png?${params.toString()}`;
}

// ============ COMMANDS ============

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'bạn';

  await bot.sendMessage(chatId,
    `Xin chào *${name}* 👋\n\n` +
    `Chào mừng đến cửa hàng!\n` +
    `Gõ /shop để xem sản phẩm và mua hàng.\n` +
    `Gõ /myorders để xem đơn của bạn.`,
    { parse_mode: 'Markdown' }
  );
});

// /shop - danh sách sản phẩm
bot.onText(/\/shop/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const data = await getData();
    const products = data.products.filter(p => p.types.some(t => t.stock > 0));

    if (!products.length) {
      return bot.sendMessage(chatId, 'Hiện chưa có sản phẩm nào.');
    }

    const keyboard = products.map(p => [{
      text: `🛒 ${p.name}`,
      callback_data: `product_${p.id}`
    }]);

    await bot.sendMessage(chatId, '*Danh sách sản phẩm:*\nChọn sản phẩm bạn muốn mua:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, 'Lỗi khi tải sản phẩm. Thử lại sau.');
  }
});

// /myorders
bot.onText(/\/myorders/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const data = await getData();
    const myOrders = data.orders
      .filter(o => o.userId === msg.from.id)
      .slice(-10)
      .reverse();

    if (!myOrders.length) {
      return bot.sendMessage(chatId, 'Bạn chưa có đơn hàng nào.');
    }

    let text = '*Đơn hàng gần đây của bạn:*\n\n';
    myOrders.forEach(o => {
      const statusMap = {
        pending: '⏳ Chờ thanh toán',
        waiting_confirm: '🕐 Chờ admin duyệt',
        paid: '✅ Đã thanh toán',
        cancelled: '❌ Đã hủy'
      };
      text += `• *${o.id}* — ${o.productName} (${o.typeName})\n`;
      text += `  ${formatMoney(o.price)} · ${statusMap[o.status] || o.status}\n\n`;
    });

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, 'Lỗi khi tải đơn hàng.');
  }
});

// /setadmin - chỉ dùng 1 lần để lưu chat id admin
bot.onText(/\/setadmin/, async (msg) => {
  ADMIN_CHAT_ID = msg.chat.id;
  // Lưu vào JSONBin luôn
  try {
    const data = await getData();
    data.config = data.config || {};
    data.config.adminChatId = msg.chat.id;
    await saveData(data);
    await bot.sendMessage(msg.chat.id, `✅ Đã set admin chat ID: \`${msg.chat.id}\`\nTừ giờ bot sẽ báo đơn mới về đây.`, {
      parse_mode: 'Markdown'
    });
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `✅ Đã set tạm: ${msg.chat.id}\n(Nhưng chưa lưu được vào JSONBin)`);
  }
});

// ============ CALLBACK QUERY ============
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const dataCb = query.data;
  const from = query.from;

  try {
    // Chọn sản phẩm → hiện các loại
    if (dataCb.startsWith('product_')) {
      const productId = dataCb.replace('product_', '');
      const data = await getData();
      const product = data.products.find(p => p.id === productId);

      if (!product) {
        return bot.answerCallbackQuery(query.id, { text: 'Sản phẩm không tồn tại' });
      }

      const availableTypes = product.types.filter(t => t.stock > 0);
      if (!availableTypes.length) {
        return bot.answerCallbackQuery(query.id, { text: 'Hết hàng' });
      }

      const keyboard = availableTypes.map(t => [{
        text: `${t.name} — ${formatMoney(t.price)} (còn ${t.stock})`,
        callback_data: `type_${productId}_${t.id}`
      }]);

      keyboard.push([{ text: '« Quay lại', callback_data: 'back_shop' }]);

      await bot.editMessageText(
        `*${product.name}*\n\nChọn loại bạn muốn mua:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
      return bot.answerCallbackQuery(query.id);
    }

    // Quay lại danh sách
    if (dataCb === 'back_shop') {
      const data = await getData();
      const products = data.products.filter(p => p.types.some(t => t.stock > 0));
      const keyboard = products.map(p => [{
        text: `🛒 ${p.name}`,
        callback_data: `product_${p.id}`
      }]);

      await bot.editMessageText('*Danh sách sản phẩm:*\nChọn sản phẩm bạn muốn mua:', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
      return bot.answerCallbackQuery(query.id);
    }

    // Chọn loại → tạo đơn + gửi QR
    if (dataCb.startsWith('type_')) {
      const parts = dataCb.split('_');
      const productId = parts[1];
      const typeId = parts[2];

      const data = await getData();
      const product = data.products.find(p => p.id === productId);
      if (!product) {
        return bot.answerCallbackQuery(query.id, { text: 'Sản phẩm không tồn tại' });
      }
      const type = product.types.find(t => t.id === typeId);
      if (!type || type.stock < 1) {
        return bot.answerCallbackQuery(query.id, { text: 'Hết hàng hoặc loại không tồn tại' });
      }

      // Tạo đơn
      const orderId = makeOrderId();
      const order = {
        id: orderId,
        userId: from.id,
        username: from.username || '',
        fullName: [from.first_name, from.last_name].filter(Boolean).join(' '),
        productId,
        productName: product.name,
        typeId,
        typeName: type.name,
        price: type.price,
        quantity: 1,
        status: 'pending',
        paymentNote: orderId,
        createdAt: new Date().toISOString()
      };

      data.orders.push(order);
      await saveData(data);

      // Gửi QR
      const qrUrl = vietQRUrl(type.price, orderId);
      const caption =
        `🧾 *Đơn hàng ${orderId}*\n\n` +
        `Sản phẩm: *${product.name}*\n` +
        `Loại: *${type.name}*\n` +
        `Số tiền: *${formatMoney(type.price)}*\n\n` +
        `📲 Quét mã QR bên dưới để chuyển khoản\n` +
        `Nội dung CK: \`${orderId}\`\n\n` +
        `Sau khi chuyển xong, bấm nút *Đã thanh toán* bên dưới.`;

      await bot.sendPhoto(chatId, qrUrl, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Đã thanh toán', callback_data: `paid_${orderId}` }
          ]]
        }
      });

      // Xóa message cũ
      try { await bot.deleteMessage(chatId, query.message.message_id); } catch (_) {}

      // Báo admin nếu có
      const adminId = ADMIN_CHAT_ID || (data.config && data.config.adminChatId);
      if (adminId) {
        try {
          await bot.sendMessage(adminId,
            `🛒 *Đơn mới*\n` +
            `Mã: \`${orderId}\`\n` +
            `Khách: ${order.fullName} (@${order.username || '—'})\n` +
            `${product.name} · ${type.name}\n` +
            `💰 ${formatMoney(type.price)}\n` +
            `Trạng thái: Chờ khách thanh toán`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) { console.error('Không gửi được cho admin', e.message); }
      }

      return bot.answerCallbackQuery(query.id, { text: 'Đã tạo đơn hàng' });
    }

    // Khách bấm "Đã thanh toán"
    if (dataCb.startsWith('paid_')) {
      const orderId = dataCb.replace('paid_', '');
      const data = await getData();
      const order = data.orders.find(o => o.id === orderId);

      if (!order) {
        return bot.answerCallbackQuery(query.id, { text: 'Không tìm thấy đơn' });
      }
      if (order.userId !== from.id) {
        return bot.answerCallbackQuery(query.id, { text: 'Đây không phải đơn của bạn' });
      }
      if (order.status !== 'pending') {
        return bot.answerCallbackQuery(query.id, { text: 'Đơn đã được xử lý rồi' });
      }

      order.status = 'waiting_confirm';
      order.paidRequestAt = new Date().toISOString();
      await saveData(data);

      // Cập nhật message
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [[{ text: '🕐 Đã gửi yêu cầu duyệt', callback_data: 'noop' }]] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (_) {}

      await bot.sendMessage(chatId,
        `✅ Bạn đã báo *Đã thanh toán* cho đơn \`${orderId}\`.\n` +
        `Admin sẽ kiểm tra và xác nhận sớm. Cảm ơn bạn!`,
        { parse_mode: 'Markdown' }
      );

      // Báo admin
      const adminId = ADMIN_CHAT_ID || (data.config && data.config.adminChatId);
      if (adminId) {
        try {
          await bot.sendMessage(adminId,
            `🔔 *Khách báo đã thanh toán*\n` +
            `Mã đơn: \`${orderId}\`\n` +
            `Khách: ${order.fullName} (@${order.username || '—'})\n` +
            `${order.productName} · ${order.typeName}\n` +
            `💰 ${formatMoney(order.price)}\n` +
            `Nội dung CK: \`${order.paymentNote}\`\n\n` +
            `➡️ Vào Admin HTML để *Duyệt & trừ kho*`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) { console.error(e.message); }
      }

      return bot.answerCallbackQuery(query.id, { text: 'Đã gửi yêu cầu duyệt' });
    }

    if (dataCb === 'noop') {
      return bot.answerCallbackQuery(query.id);
    }

  } catch (err) {
    console.error('Callback error:', err);
    bot.answerCallbackQuery(query.id, { text: 'Có lỗi xảy ra' });
  }
});

// Lỗi polling
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot sẵn sàng nhận tin nhắn.');
