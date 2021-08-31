'use strict';

const webVcdParser = require('vcd-stream/lib/web-vcd-parser.js');
const getReaders = require('./get-readers.js');
const vcdPipeDeso = require('./vcd-pipe-deso.js');
const domContainer = require('@wavedrom/gl/lib/dom-container.js');
const createVCD = require('vcd-stream/out/vcd.js');

const getElement = divName => {
  if (typeof divName === 'string') {
    const c = document.getElementById(divName);
    if (c === null) {
      throw new Error('<div> element width Id: "' + divName + '" not found');
    }
    return c;
  }
  return divName;
};

global.VCDrom = async (divName) => {

  const content = getElement(divName);

  const mod = await createVCD();

  const inst = await webVcdParser(mod); // VCD parser instance

  const handler = async readers => {
    const [r0, r1] = readers;

    let waveql;
    {
      if (r1 && (r1.reader)) {
        const utf8Decoder = new TextDecoder('utf-8');
        waveql = '';
        for (let i = 0; i < 1e5; i++) {
          const { done, value } = await r1.reader.read();
          waveql += value ? utf8Decoder.decode(value, {stream: true}) : '';
          if (done) {
            break;
          }
        }
      }
    }

    vcdPipeDeso({}, inst, deso => {
      console.log('parsed', deso);
      content.innerHTML = '';
      deso.waveql = waveql;
      domContainer(content, deso);
    });

    content.innerHTML = '<div class="wd-progress">LOADING...</div>';
    let total = 0;
    const maxChunkLength = 300000;
    outerLoop:
    for (let i = 0; i < 1e5; i++) {
      const { done, value } = await r0.reader.read();
      const len = (value || '').length;

      if (done && (len === 0)) {
        console.log('the end');
        inst.end();
        break outerLoop;
      }

      for (let j = 0; j < len; j += maxChunkLength) {
        const value1 = value.slice(j, j + maxChunkLength);
        const len1 = value1.length;
        total += len1;
        console.log({len1, done, total});
        content.innerHTML = '<div class="wd-progress">' + total.toLocaleString() + '</div>';
        if (done && ((j + maxChunkLength) >= len)) {
          console.log('last chunk');
          inst.end(value1);
          break outerLoop;
        }
        inst.write(value1);
      }
    }
  };


  await getReaders(handler);
};

/* eslint-env browser */