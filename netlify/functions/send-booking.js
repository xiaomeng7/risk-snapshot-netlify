const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.BOOKING_TO_EMAIL || 'info@bhtechnology.com.au';
const FROM_EMAIL = process.env.PDF_FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.PDF_FROM_NAME || 'Better Home Technology';

function buildLeadEmailEn(payload) {
  const { name, phone, email, notes, summary } = payload;
  return `Hello,

I've just completed the Electrical Risk Snapshot on your website and would like to request an independent electrical assessment.

My details are below:

Name: ${name}
Phone: ${phone}
Email: ${email}

Property type:
• Investment property

Reason for enquiry:
• I would like clearer visibility and independent advice before making future electrical decisions.

${notes ? `Additional notes:\n• ${notes}\n\n` : ''}Snapshot summary (for reference):
${summary || '(none)'}

Please let me know the next steps.

Kind regards,
${name}
`;
}

function buildQuickCallEmailEn(payload) {
  const { name, phone, email, suburb, dateReadable, window, notes, summary } = payload;
  return `Hello,

I've just completed the Electrical Risk Snapshot and would like to request a quick suitability call.

My details are below:

Name: ${name}
Phone: ${phone}
Email: ${email}
${suburb ? `Property area: ${suburb}\n` : ''}

Preferred call time (Adelaide):
Date: ${dateReadable || '(not set)'}
Window: ${window || '(not set)'}

${notes ? `Notes:\n${notes}\n\n` : ''}Snapshot summary (for reference):
${summary || '(none)'}

Kind regards,
${name}
`;
}

function buildQuickCallEmailZh(payload) {
  const { name, phone, email, address, slot, note, summary, utm, page } = payload;
  let body = '您好，BH Technology 团队：\n\n';
  body += '我刚完成【电路风险快照】，希望预约 15 分钟免费解读快照结果。\n\n';
  body += '【联系方式】\n';
  body += `姓名：${name || ''}\n`;
  body += `电话：${phone || ''}\n`;
  body += `邮箱：${email || ''}\n`;
  if (address) body += `地址：${address}\n`;
  if (slot) body += `期望通话时间：${slot}\n`;
  if (note) body += `备注：${note}\n`;
  body += '\n【快照选择结果】\n';
  body += summary || '(无)';
  body += '\n\n【我的来源】\n';
  body += `utm：${utm || '未标记'}\n`;
  body += `页面：${page || ''}\n\n谢谢！\n';
  return body;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const type = body.type === 'quickcall' ? 'quickcall' : 'lead';
  const lang = (body.lang || 'en').toLowerCase() === 'zh' ? 'zh' : 'en';
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();

  if (!name || !phone || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing name, phone or email' }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Email service not configured' }) };
  }

  let text, subject;
  if (type === 'lead') {
    subject = 'Request for Independent Electrical Risk Assessment';
    text = buildLeadEmailEn({
      name,
      phone,
      email,
      notes: (body.notes || '').trim(),
      summary: body.summary || '',
    });
  } else if (lang === 'zh') {
    subject = '预约 15 分钟免费解读快照结果';
    text = buildQuickCallEmailZh({
      name,
      phone,
      email,
      address: (body.address || '').trim(),
      slot: (body.slot || '').trim(),
      note: (body.note || '').trim(),
      summary: body.summary || '',
      utm: body.utm || '',
      page: body.page || '',
    });
  } else {
    subject = 'Request a quick suitability call';
    text = buildQuickCallEmailEn({
      name,
      phone,
      email,
      suburb: (body.suburb || '').trim(),
      dateReadable: body.dateReadable || '',
      window: body.window || '',
      notes: (body.notes || '').trim(),
      summary: body.summary || '',
    });
  }

  const resend = new Resend(RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject,
      text,
    });
    if (error) {
      console.error('Resend error:', error);
      return { statusCode: 502, body: JSON.stringify({ error: error.message || 'Failed to send' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: data?.id }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Server error' }) };
  }
};
