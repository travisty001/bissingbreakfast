const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendOrderAlert } = require('./sms');
const env = {SMS_GMAIL_USER:'test@example.invalid',SMS_GMAIL_APP_PASSWORD:'fake'};
const logger = {log(){},error(){}};
const order = {text:'TEST breakfast order',orderId:'test'};
const recipients = ['7852593556@vtext.com','2143358780@tmomail.net','7852596900@vtext.com'];

test('every new and updated breakfast alert goes to all three recipients, awaiting SMTP', async () => {
  const messages = [];
  let finish;
  const pending = sendOrderAlert(order,{env,logger,mailer:{createTransport:()=>({sendMail:m=>{messages.push(m);return new Promise(r=>finish=r)}})}});
  let done=false;pending.then(()=>done=true);
  await Promise.resolve(); assert.equal(done,false);
  finish({accepted:recipients,rejected:[]});
  assert.equal((await pending).status,'smtp_accepted');
  await sendOrderAlert({...order,orderId:'updated'},{env,logger,mailer:{createTransport:()=>({sendMail:async m=>{messages.push(m);return {accepted:m.to,rejected:[]}}})}});
  assert.deepEqual(messages.map(m=>m.to),[recipients,recipients]);
});
test('missing credentials do not contact mailer',async()=>{
  const mailer={createTransport(){throw new Error('must not contact SMTP')}};
  assert.equal((await sendOrderAlert(order,{env:{},logger,mailer})).status,'missing_credentials');
});
test('partial acceptance, rejection and errors are reported without failing saved orders',async()=>{
  const deps={env,logger,mailer:{createTransport:()=>({sendMail:async()=>({accepted:recipients.slice(0,1),rejected:[]})})}};
  assert.equal((await sendOrderAlert(order,deps)).status,'smtp_unconfirmed');
  deps.mailer.createTransport=()=>({sendMail:async()=>({accepted:recipients.slice(0,2),rejected:[recipients[2]]})});
  assert.equal((await sendOrderAlert(order,deps)).status,'smtp_rejected');
  deps.mailer.createTransport=()=>({sendMail:async()=>{throw Object.assign(new Error('private details'),{code:'EAUTH'})}});
  assert.deepEqual(await sendOrderAlert(order,deps),{status:'failed',code:'EAUTH'});
});
