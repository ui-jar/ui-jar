import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as ts from 'typescript';
import { FileSearch } from '../../src/generator/file-search';

describe('FileSearch', () => {

    describe('getFiles', () => {
        it('should get all files that ends with ".ts" in directory', () => {
            const shouldBeIncluded = ['foo.ts', 'foobar.ts', 'foo.test.ts'];
            const shouldNotBeIncluded = ['foobar.txt', 'bar.js'];
            let readdirSyncStub = sinon.stub(fs, 'readdirSync');
            readdirSyncStub.returns(shouldBeIncluded.concat(shouldNotBeIncluded));

            let statSyncStub = sinon.stub(fs, 'statSync');
            statSyncStub.returns({ isDirectory: () => false, isFile: () => true });

            const fileSearch = new FileSearch([/\.ts$/], []);
            const result = fileSearch.getFiles('./app/root/dir');

            const filterResult = result.filter((fileName) => {
                return shouldBeIncluded.find((includedFileName) => new RegExp(includedFileName + '$', 'gi').test(fileName));
            });

            assert.equal(result.length, shouldBeIncluded.length, 'Result and expected length should be equal');
            assert.deepEqual(filterResult, result, 'Expected file search result to be only included files');

            readdirSyncStub.restore();
            statSyncStub.restore();
        });
    });

    describe('getTestFiles', () => {
        it('should get all files that includes test with @uijar annotations', () => {
            const filesInSearch = ['foo.ts', 'foobar.ts', 'foo.test.ts', 'bar.test.ts'];

            let readdirSyncStub = sinon.stub(fs, 'readdirSync');
            readdirSyncStub.returns(filesInSearch);

            let statSyncStub = sinon.stub(fs, 'statSync');
            statSyncStub.returns({ isDirectory: () => false, isFile: () => true });

            const fileSearch = new FileSearch([/\.ts$/], []);
            const files = fileSearch.getFiles('./app/root/dir');
            const compilerHost = getTestCompilerHost();
            const program: ts.Program = ts.createProgram([...files],
                { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }, compilerHost);

            const testFiles = fileSearch.getTestFiles(files, program);

            assert.equal(testFiles.length, 2, 'Only two files "foo.test.ts" and "bar.test.ts" should include tests.');

            testFiles.forEach((testFile) => {
                if(testFile.indexOf('foo.test.ts') > -1) {
                    assert.equal(testFile.indexOf('foo.test.ts') > -1, true, 'Test file should be "foo.test.ts".');
                } else if(testFile.indexOf('bar.test.ts') > -1) {
                    assert.equal(testFile.indexOf('bar.test.ts') > -1, true, 'Test file should be "bar.test.ts".');
                } else {
                    assert.equal(false, true, 'If this happens, we have an error in test file search.');
                }
            });
            
            readdirSyncStub.restore();
            statSyncStub.restore();
        });
    });
});

function getTestCompilerHost() {
    const testSourceFileContent = `
    describe('TestComponent', () => {
        let component: TestComponent;
        let fixture: ComponentFixture<TestComponent>;
      
        beforeEach(async(() => {
          /** 
           * @uijar TestComponent
           */
          let moduleDef = { imports: [CommonModule], declarations: [TestComponent] };
          TestBed.configureTestingModule(moduleDef).compileComponents();
        }));
      
        beforeEach(() => {
          fixture = TestBed.createComponent(TestComponent);
          component = fixture.componentInstance;
          fixture.detectChanges();
        });
        
        /** @uijarexample */
        it('should be created', () => {
            // ...
        });
      });
    `;

    const sourceFileContent = `const foobar = true;`;

    let compilerHost = ts.createCompilerHost({ target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    compilerHost.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget,
        onError?: (message: string) => void): ts.SourceFile => {

        if (fileName.indexOf('.test.ts') > -1) {
            return ts.createSourceFile(fileName, testSourceFileContent, ts.ScriptTarget.ES5);
        }

        return ts.createSourceFile(fileName, sourceFileContent, ts.ScriptTarget.ES5);
    };

    return compilerHost;
}