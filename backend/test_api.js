import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 4000, path: '/api/v1/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@dentalclinic.com', password: 'Admin123!' }));

  const token = loginRes.data.accessToken;
  console.log('=== LOGIN OK, token obtained ===');

  // Get patients
  const patientsRes = await makeRequest({
    hostname: 'localhost', port: 4000, path: '/api/v1/patients',
    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('=== PATIENTS RESPONSE (full structure) ===');
  console.log(JSON.stringify(patientsRes, null, 2).substring(0, 3000));
  console.log('=== typeof data:', typeof patientsRes.data, '===');
  console.log('=== Array.isArray(data):', Array.isArray(patientsRes.data), '===');
  if (patientsRes.data && !Array.isArray(patientsRes.data)) {
    console.log('=== data keys:', Object.keys(patientsRes.data), '===');
  }
  if (Array.isArray(patientsRes.data)) {
    console.log('=== data.length:', patientsRes.data.length, '===');
  }
}

main().catch(console.error);
