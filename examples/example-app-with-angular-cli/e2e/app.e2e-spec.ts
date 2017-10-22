import { UiJarExampleAppPage } from './app.po';

describe('ui-jar-example-app App', () => {
  let page: UiJarExampleAppPage;

  beforeEach(() => {
    page = new UiJarExampleAppPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
