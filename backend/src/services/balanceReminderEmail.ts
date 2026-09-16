export interface BalanceReminderEmailInput {
  to: string;
  airportName: string;
  balance: number;
  portalLoginUrl: string;
}

export function renderBalanceReminderEmail(input: BalanceReminderEmailInput) {
  const url = new URL(input.portalLoginUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid portal login URL');
  }
  const balance = `¥${input.balance.toFixed(2)}`;
  const impact = '余额不足时，公开评分展示及榜单排序将受到影响，进而减少推广曝光。';
  const guidance = '为保持推广连续性，请尽快登录 GateRank 后台完成充值，并预留充足余额。';
  const name = escapeHtml(input.airportName);
  const href = escapeHtml(url.href);
  return {
    subject: `【GateRank】余额提醒，请及时充值以免影响排名推广 - ${input.airportName}`,
    text: [
      `您好，${input.airportName} 当前账户余额为 ${balance}。`, '', impact, guidance, '',
      `登录后台充值：${url.href}`, '登录后进入「充值」，选择充值金额并完成支付。', '',
      '如已完成充值，请忽略本邮件。感谢您的支持与配合。',
    ].join('\n'),
    html: [
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GateRank 余额提醒</title></head>',
      '<body style="margin:0;padding:0;background:#f5f5f5;color:#171717;font-family:Arial,\'Microsoft YaHei\',sans-serif;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:28px 12px;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;"><tr><td style="padding:28px 24px;">',
      '<div style="font-size:16px;font-weight:700;letter-spacing:1px;">GateRank</div>',
      '<h1 style="margin:24px 0 10px;font-size:24px;line-height:1.4;">及时充值，保持推广连续性</h1>',
      `<p style="margin:0 0 22px;color:#525252;font-size:15px;line-height:1.8;overflow-wrap:anywhere;">${name} 负责人，您好：</p>`,
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;"><tr><td style="padding:20px;">',
      '<div style="color:#737373;font-size:13px;">当前账户余额</div>',
      `<div style="margin-top:8px;color:#c2410c;font-size:34px;line-height:1.2;font-weight:700;">${balance}</div>`,
      '<div style="margin-top:10px;color:#737373;font-size:12px;line-height:1.6;">余额为发送时的账户快照，最新金额请以后台为准。</div>',
      '</td></tr></table>',
      `<p style="margin:22px 0 10px;font-size:15px;line-height:1.9;">${impact}</p>`,
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:#525252;">${guidance}</p>`,
      `<div style="margin:24px 0;text-align:center;"><a href="${href}" style="display:inline-block;padding:14px 28px;background:#171717;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">登录后台充值</a></div>`,
      '<p style="margin:0;color:#525252;font-size:13px;line-height:1.8;">登录后进入「充值」，选择充值金额并完成支付。</p>',
      `<p style="margin:14px 0 0;color:#737373;font-size:12px;line-height:1.8;">后台登录地址：<br><a href="${href}" style="color:#4338ca;text-decoration:underline;word-break:break-all;">${href}</a></p>`,
      '<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #eeeeee;color:#737373;font-size:12px;line-height:1.8;">如已完成充值，请忽略本邮件。<br>感谢您的支持与配合。<br>GateRank 运营团队</p>',
      '</td></tr></table></td></tr></table></body></html>',
    ].join(''),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
