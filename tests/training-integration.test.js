'use strict';
const test=require('node:test');
const {verify}=require('../scripts/check-training-integration.cjs');
test('full static HELP toolkit and publisher artwork remain available',verify);
