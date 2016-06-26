import test from 'ava';
import NitroFrontifyDeployer from '..';
import denodeify from 'denodeify';
import path from 'path';

import frontifyApi from '@frontify/frontify-api';

const copy = denodeify(require('ncp').ncp);
const mkdirp = denodeify(require('mkdirp'));
const rimraf = denodeify(require('rimraf'));
const readFile = denodeify(require('fs').readFile);
const writeFile = denodeify(require('fs').writeFile);
const unlink = denodeify(require('fs').unlink);

const tmp = path.resolve(__dirname, '..', 'tmp', 'testing');
const fixtures = path.resolve(__dirname, 'fixtures');
const compilerMock = (tpl) => () => tpl.toUpperCase();

async function getErrorMessage(cb) {
  try {
    await Promise.resolve().then(cb);
  } catch(e) {
    return e.message;
  }
}

// Overwrite frontify api
frontifyApi.syncPatterns = () => new Promise((resolve) => resolve('mock-result'));

let testDirId = 0;
async function createTestEnvironment(environment = 'valid') {
  const targetDir = path.resolve(tmp, 'test-' + testDirId++);
  const componentDir = path.join(targetDir, 'components');
  const tmpDir = path.join(targetDir, 'tmp');
  await mkdirp(tmpDir)
  await copy(path.join(fixtures, environment), targetDir);
  return {componentDir, tmpDir};
}

test('should verify that all files are valid', async t => {
    const {componentDir, tmpDir} = await createTestEnvironment('valid');
    const deployer = new NitroFrontifyDeployer({
      rootDirectory: componentDir,
      mapping: { 'atoms': 'atom' },
      compiler: compilerMock,
      targetDir: tmpDir
    });
    t.is(await deployer.validateComponents(), true);
    t.pass();
});

test('should throw if a component is not valid', async t => {
    const {componentDir, tmpDir} = await createTestEnvironment('invalid');
    const deployer = new NitroFrontifyDeployer({
      rootDirectory: componentDir,
      mapping: { 'atoms': 'atom' },
      compiler: compilerMock,
      targetDir: tmpDir
    });
    var err = await getErrorMessage(async () => {
      await deployer.validateComponents();
    });
    var invalidFile = path.join(componentDir, 'atoms', 'button', 'pattern.json');
    var expectedMessage = `Schema "frontify-deployer-schema" can't be applied for "${invalidFile}" because data.stability should be equal to one of the allowed values`;
    t.is(err, expectedMessage);
    t.pass();
});

test('should throw no component exists', async t => {
    const {componentDir, tmpDir} = await createTestEnvironment('empty');
    const deployer = new NitroFrontifyDeployer({
      rootDirectory: componentDir,
      mapping: { 'atoms': 'atom' },
      compiler: compilerMock,
      targetDir: tmpDir
    });
    var err;
    try {
      await deployer.validateComponents();
    } catch(e) {
      err = e;
    }
    var expectedMessage = `Component validation failed - no components found`;
    t.is(err.message, expectedMessage);
    t.pass();
});

test('should throw if the component type is not in the mapping', async t => {
    const {componentDir, tmpDir} = await createTestEnvironment('valid');
    const deployer = new NitroFrontifyDeployer({
      rootDirectory: componentDir,
      mapping: { },
      compiler: compilerMock,
      targetDir: tmpDir
    });
    var err;
    try {
      await deployer.validateComponents();
    } catch(e) {
      err = e;
    }
    var expectedMessage = `Folder name "atoms" is not in the mapping.`;
    t.is(err.message, expectedMessage);
    t.pass();
});

test('should generate the transferdata for a component', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir
  });
  const buttonComponent = await deployer.nitroPatternResolver.getComponent('atoms/button');
  var transferData = await deployer._generateComponentTransferData(buttonComponent);
  var expected = {
    'name': 'button',
    'type': 'atom',
    'stability': 'beta',
    'id': 189,
    'variations': {
      '_example/example.hbs': {
        'name': 'button example',
        'assets': {
          'html': [
            'atoms/button/example.html'
          ]
        }
      }
    }
  };
  t.deepEqual(transferData, expected);
  t.pass();
});

test('should generate the transferdata for another component', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir
  });
  const radioComponent = await deployer.nitroPatternResolver.getComponent('atoms/radio');
  var transferData = await deployer._generateComponentTransferData(radioComponent);
  var expected = {
    'stability': 'stable',
    'name': 'radio',
    'type': 'atom',
    'variations': {
      '_example/desktop.hbs': {
        'name': 'radio desktop',
        'assets': {
          'html': [
            'atoms/radio/desktop.html'
          ]
        }
      },
      '_example/mobile.hbs': {
        'name': 'radio mobile',
        'assets': {
          'html': [
            'atoms/radio/mobile.html'
          ]
        }
      }
    }
  };
  t.deepEqual(transferData, expected);
  t.pass();
});

test('should compile a components examples', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir
  });
  const buttonComponent = await deployer.nitroPatternResolver.getComponent('atoms/button');
  await deployer._buildComponent(buttonComponent);
  const renderedTemplate = await readFile(path.join(tmpDir, 'atoms', 'button', 'example.html'));
  t.is(renderedTemplate.toString(), "HELLO WORLD");
  t.pass();
});

test('should compile a components examples', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir
  });
  await deployer._buildComponents();
  const renderedTemplate = await readFile(path.join(tmpDir, 'atoms', 'button', 'example.html'));
  t.is(renderedTemplate.toString(), "HELLO WORLD");
  t.pass();
});

test('should generate a components pattern.json', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir
  });
  const buttonComponent = await deployer.nitroPatternResolver.getComponent('atoms/button');
  await deployer._buildComponent(buttonComponent);
  const patternJson = await readFile(path.join(tmpDir, 'atoms', 'button', 'pattern.json'));
  const patternData = JSON.parse(patternJson.toString());
  var transferData = await deployer._generateComponentTransferData(buttonComponent);
  t.deepEqual(patternData, transferData);
  t.pass();
});

test('should deploy without any error', async t => {
  const {componentDir, tmpDir} = await createTestEnvironment('valid');
  const deployer = new NitroFrontifyDeployer({
    rootDirectory: componentDir,
    mapping: { 'atoms': 'atom' },
    compiler: compilerMock,
    targetDir: tmpDir,
    frontifyOptions: {}
  });
  var deployResult = await deployer.deploy();
  t.deepEqual(deployResult, 'mock-result');
  t.pass();
});

test.after.always('cleanup', async t => {
  await rimraf(tmp);
});