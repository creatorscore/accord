const jwt = require('jsonwebtoken');

const TEAM_ID = '9ZLQKAZ6TT';
const CLIENT_ID = 'com.privyreviews.accord.service';
const KEY_ID = 'P689FY74JU';

const privateKey = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgV/oTf65OLIH9LT8e
DzSfoELQQrWx4z8vI+eRh0lRhxKgCgYIKoZIzj0DAQehRANCAAQ5RCeqXasWf1pL
ooEc/9M1vicEcfhLuuIfkGrZKg/lfXbUw3XpqQ+aLtjWQDxUcDlLj4GTJzqX4DHK
KAbzOmuJ
-----END PRIVATE KEY-----`;

try {
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: TEAM_ID,
    subject: CLIENT_ID,
    header: {
      alg: 'ES256',
      kid: KEY_ID
    }
  });

  console.log('\n✅ JWT Secret Generated Successfully!\n');
  console.log('==================================================');
  console.log('CLIENT ID: com.privyreviews.accord.service');
  console.log('==================================================');
  console.log('JWT SECRET (copy this entire token):\n');
  console.log(token);
  console.log('\n==================================================');
} catch (error) {
  console.error('❌ Error:', error.message);
}
