const {test} = require('node:test');
const assert = require('node:assert/strict');
const {sendOrderAlert,testOnly}=require('./sms');
const env={SMS_GMAIL_USER:'test@example.invalid',SMS_GMAIL_APP_PASSWORD:'fake'};
const logger={log(){},error(){}};
const order={enabled:true,text:'TEST breakfast order',orderId:'test'};
test('both test orders only address Travis and await SMTP',async()=>{
  const messages=[];
  let finish;
  const pending=sendOrderAlert(order,{env,logger,mailer:{createTransport:()=>({sendMail:m=>{messages.push(m);return new Promise(r=>finish=r)}})}});
  let done=false;pending.then(()=>done=true);
  await Promise.resolve();assert.equal(done,false);
  finish({accepted:['7852596900@vtext.com'],rejected:[]});
  assert.equal((await pending).status,'smtp_accepted');
  await sendOrderAlert({...order,orderId:'test2'},{env,logger,mailer:{createTransport:()=>({sendMail:async m=>{messages.push(m);return {accepted:m.to,rejected:[]}}})}});
  assert.deepEqual(messages.map(m=>m.to),[['7852596900@vtext.com'],['7852596900@vtext.com']]);
});
test('disabled or missing credentials never contacts SMTP',async()=>{
  const mailer={createTransport(){throw new Error('must not contact SMTP')}};
  assert.equal((await sendOrderAlert({...order,enabled:false},{env,logger,mailer})).status,'disabled');
  assert.equal((await sendOrderAlert(order,{env:{},logger,mailer})).status,'missing_credentials');
});
test('SMTP rejection and errors reported without losing order',async()=>{
  const deps={env,logger,mailer:{createTransport:()=>({sendMail:async()=>({accepted:[],rejected:['7852596900@vtext.com']})})}};
  assert.equal((await sendOrderAlert(order,deps)).status,'smtp_rejected');
  deps.mailer.createTransport=()=>({sendMail:async()=>{throw Object.assign(new Error('private details'),{code:'EAUTH'})}});
  assert.deepEqual(await sendOrderAlert(order,deps),{status:'failed',mode:'travis_only',code:'EAUTH'});
});
test('test mode fails closed for absent or mistyped configuration',()=>{
  for(const value of [undefined,'','true','FALSE','typo'])assert.equal(testOnly({SMS_TEST_ONLY:value}),true);
  assert.equal(testOnly({SMS_TEST_ONLY:'false'}),false);
});
