import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureRepository } from '../src/data/fixtureRepository.mjs';

test('fixture releaseToErp does not create duplicate ERP jobs for the same request', async () => {
  const repository = createFixtureRepository();

  const firstRelease = await repository.releaseToErp({
    requestId: 'req-finance-shared',
    actorId: 'finance-ops-1',
  });

  assert.equal(firstRelease.erpSyncStatus, 'pending');

  const jobsAfterFirstRelease = await repository.listIntegrationJobs();
  const matchingAfterFirst = jobsAfterFirstRelease.filter(
    (entry) => entry.requestId === 'req-finance-shared' && entry.targetSystem === 'erp'
  );

  assert.equal(matchingAfterFirst.length, 1);
  assert.equal(matchingAfterFirst[0].idempotencyKey, 'payment_request:req-finance-shared');

  const secondRelease = await repository.releaseToErp({
    requestId: 'req-finance-shared',
    actorId: 'finance-ops-1',
  });

  assert.equal(secondRelease.erpSyncStatus, 'pending');

  const jobsAfterSecondRelease = await repository.listIntegrationJobs();
  const matchingAfterSecond = jobsAfterSecondRelease.filter(
    (entry) => entry.requestId === 'req-finance-shared' && entry.targetSystem === 'erp'
  );

  assert.equal(matchingAfterSecond.length, 1);
  assert.equal(matchingAfterSecond[0].idempotencyKey, 'payment_request:req-finance-shared');
});
