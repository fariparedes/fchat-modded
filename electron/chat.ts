/**
 * @license
 * MIT License
 *
 * Copyright (c) 2018 F-List
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This license header applies to this file and all of the non-third-party assets it includes.
 * @file The entry point for the Electron renderer of F-Chat 3.0.
 * @copyright 2018 F-List
 * @author Maya Wolf <maya@f-list.net>
 * @version 3.0
 * @see {@link https://github.com/f-list/exported|GitHub repo}
 */
import Axios from 'axios';
import {exec, execSync} from 'child_process';
import * as electron from 'electron';
import * as path from 'path';
import * as qs from 'querystring';
import {getKey} from '../chat/common';
import {init as initCore} from '../chat/core';
import l from '../chat/localize';
import {setupRaven} from '../chat/vue-raven';
import Socket from '../chat/WebSocket';
import Connection from '../fchat/connection';
import {Keys} from '../keys';
import {GeneralSettings/*, nativeRequire*/} from './common';
import {Logs, SettingsStore} from './filesystem';
import * as SlimcatImporter from './importer';
import Index from './Index.vue';
import Notifications from './notifications';

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if(e.ctrlKey && e.shiftKey && getKey(e) === Keys.KeyI)
        electron.remote.getCurrentWebContents().toggleDevTools();
});

/*process.env.SPELLCHECKER_PREFER_HUNSPELL = '1';
const sc = nativeRequire<{
    Spellchecker: new() => {
        add(word: string): void
        remove(word: string): void
        isMisspelled(x: string): boolean
        setDictionary(name: string | undefined, dir: string): void
        getCorrectionsForMisspelling(word: string): ReadonlyArray<string>
    }
}>('spellchecker/build/Release/spellchecker.node');
const spellchecker = new sc.Spellchecker();*/

Axios.defaults.params = {__fchat: `desktop/${electron.remote.app.getVersion()}`};

if(process.env.NODE_ENV === 'production') {
    setupRaven('https://a9239b17b0a14f72ba85e8729b9d1612@sentry.f-list.net/2', electron.remote.app.getVersion());

    electron.remote.getCurrentWebContents().on('devtools-opened', () => {
        console.log(`%c${l('consoleWarning.head')}`, 'background: red; color: yellow; font-size: 30pt');
        console.log(`%c${l('consoleWarning.body')}`, 'font-size: 16pt; color:red');
    });
}
let browser: string | undefined;

function openIncognito(url: string): void {
    if(browser === undefined)
        try { //tslint:disable-next-line:max-line-length
            browser = execSync(`FOR /F "skip=2 tokens=3" %A IN ('REG QUERY HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice /v ProgId') DO @(echo %A)`)
                .toString().trim().toLowerCase();
        } catch(e) {
            console.error(e);
        }
    const commands = {
        chrome: 'chrome.exe -incognito', firefox: 'firefox.exe -private-window', vivaldi: 'vivaldi.exe -incognito',
        opera: 'opera.exe -private'
    };
    let start = 'iexplore.exe -private';
    for(const key in commands)
        if(browser!.indexOf(key) !== -1) start = commands[<keyof typeof commands>key];
    exec(`start ${start} ${url}`);
}

const webContents = electron.remote.getCurrentWebContents();
webContents.on('context-menu', (_, props) => {
    const hasText = props.selectionText.trim().length > 0;
    const can = (type: string) => (<Electron.EditFlags & {[key: string]: boolean}>props.editFlags)[`can${type}`] && hasText;

    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
    if(hasText || props.isEditable)
        menuTemplate.push({
            id: 'copy',
            label: l('action.copy'),
            role: can('Copy') ? 'copy' : undefined,
            accelerator: 'CmdOrCtrl+C',
            enabled: can('Copy')
        });
    if(props.isEditable)
        menuTemplate.push({
            id: 'cut',
            label: l('action.cut'),
            role: can('Cut') ? 'cut' : undefined,
            accelerator: 'CmdOrCtrl+X',
            enabled: can('Cut')
        }, {
            id: 'paste',
            label: l('action.paste'),
            role: props.editFlags.canPaste ? 'paste' : undefined,
            accelerator: 'CmdOrCtrl+V',
            enabled: props.editFlags.canPaste
        });
    else if(props.linkURL.length > 0 && props.mediaType === 'none' && props.linkURL.substr(0, props.pageURL.length) !== props.pageURL) {
        menuTemplate.push({
            id: 'copyLink',
            label: l('action.copyLink'),
            click(): void {
                if(process.platform === 'darwin')
                    electron.clipboard.writeBookmark(props.linkText, props.linkURL);
                else
                    electron.clipboard.writeText(props.linkURL);
            }
        });
        if(process.platform === 'win32')
            menuTemplate.push({
                id: 'incognito',
                label: l('action.incognito'),
                click: () => openIncognito(props.linkURL)
            });
    } else if(hasText)
        menuTemplate.push({
            label: l('action.copyWithoutBBCode'),
            enabled: can('Copy'),
            accelerator: 'CmdOrCtrl+Shift+C',
            click: () => electron.clipboard.writeText(props.selectionText)
        });
    if(props.misspelledWord !== '') {
        const corrections = props.dictionarySuggestions; //spellchecker.getCorrectionsForMisspelling(props.misspelledWord);
        menuTemplate.unshift({
            label: l('spellchecker.add'),
            click: () => electron.ipcRenderer.send('dictionary-add', props.misspelledWord)
        }, {type: 'separator'});
        if(corrections.length > 0)
            menuTemplate.unshift(...corrections.map((correction: string) => ({
                label: correction,
                click: () => webContents.replaceMisspelling(correction)
            })));
        else menuTemplate.unshift({enabled: false, label: l('spellchecker.noCorrections')});
    } else if(settings.customDictionary.indexOf(props.selectionText) !== -1)
        menuTemplate.unshift({
            label: l('spellchecker.remove'),
            click: () => electron.ipcRenderer.send('dictionary-remove', props.selectionText)
        }, {type: 'separator'});

    if(menuTemplate.length > 0) electron.remote.Menu.buildFromTemplate(menuTemplate).popup({});
});

let dictDir = path.join(electron.remote.app.getPath('userData'), 'spellchecker');
if(process.platform === 'win32') //get the path in DOS (8-character) format as special characters cause problems otherwise
    exec(`for /d %I in ("${dictDir}") do @echo %~sI`, (_, stdout) => dictDir = stdout.trim());
//electron.webFrame.setSpellCheckProvider('', {spellCheck: (words, callback) => callback(words.filter((x) => spellchecker.isMisspelled(x)))});

function onSettings(s: GeneralSettings): void {
    settings = s;
    //spellchecker.setDictionary(s.spellcheckLang, dictDir);
    //for(const word of s.customDictionary) spellchecker.add(word);
}

electron.ipcRenderer.on('settings', (_: Event, s: GeneralSettings) => onSettings(s));

const params = <{[key: string]: string | undefined}>qs.parse(window.location.search.substr(1));
let settings = <GeneralSettings>JSON.parse(params['settings']!);
if(params['import'] !== undefined)
    try {
        if(SlimcatImporter.canImportGeneral() && confirm(l('importer.importGeneral'))) {
            SlimcatImporter.importGeneral(settings);
            electron.ipcRenderer.send('save-login', settings.account, settings.host);
        }
    } catch {
        alert(l('importer.error'));
    }
onSettings(settings);

const connection = new Connection(`F-Chat 3.0 (${process.platform})`, electron.remote.app.getVersion(), Socket);
initCore(connection, Logs, SettingsStore, Notifications);

//tslint:disable-next-line:no-unused-expression
new Index({
    el: '#app',
    data: {settings}
});