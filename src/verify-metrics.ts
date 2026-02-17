// Manual verification script for metrics functionality

import { register, registrationAttemptsTotal, loginAttemptsTotal, tokenValidationTotal } from './metrics';

async function verifyMetrics() {
  console.log('=== Verifying Prometheus Metrics Implementation ===\n');

  // Simulate some metric increments
  console.log('1. Simulating registration attempts...');
  registrationAttemptsTotal.inc({ status: 'success' });
  registrationAttemptsTotal.inc({ status: 'success' });
  registrationAttemptsTotal.inc({ status: 'failure' });
  console.log('   ✓ Incremented registration metrics\n');

  console.log('2. Simulating login attempts...');
  loginAttemptsTotal.inc({ status: 'success' });
  loginAttemptsTotal.inc({ status: 'failure' });
  loginAttemptsTotal.inc({ status: 'failure' });
  loginAttemptsTotal.inc({ status: 'failure' });
  console.log('   ✓ Incremented login metrics\n');

  console.log('3. Simulating token validations...');
  tokenValidationTotal.inc({ result: 'valid' });
  tokenValidationTotal.inc({ result: 'valid' });
  tokenValidationTotal.inc({ result: 'invalid' });
  console.log('   ✓ Incremented token validation metrics\n');

  // Get metrics output
  console.log('4. Generating metrics output...');
  const metrics = await register.metrics();
  console.log('   ✓ Metrics generated successfully\n');

  // Verify metrics are present
  console.log('5. Verifying metrics content...');
  const checks = [
    { name: 'Registration metrics', pattern: 'auth_registration_attempts_total' },
    { name: 'Login metrics', pattern: 'auth_login_attempts_total' },
    { name: 'Token validation metrics', pattern: 'auth_token_validation_total' },
    { name: 'Default metrics', pattern: 'process_cpu_user_seconds_total' },
    { name: 'Success label', pattern: 'status="success"' },
    { name: 'Failure label', pattern: 'status="failure"' },
    { name: 'Valid label', pattern: 'result="valid"' },
    { name: 'Invalid label', pattern: 'result="invalid"' },
  ];

  let allPassed = true;
  for (const check of checks) {
    const found = metrics.includes(check.pattern);
    console.log(`   ${found ? '✓' : '✗'} ${check.name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    if (!found) allPassed = false;
  }

  console.log('\n=== Verification Complete ===');
  console.log(`Status: ${allPassed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}\n`);

  if (allPassed) {
    console.log('Sample metrics output:');
    console.log('---');
    console.log(metrics.split('\n').slice(0, 30).join('\n'));
    console.log('...\n');
  }

  return allPassed;
}

// Run verification
verifyMetrics()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Verification failed with error:', error);
    process.exit(1);
  });
