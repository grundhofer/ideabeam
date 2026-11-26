// the licence list of „Über“, made from the dependencies by the plugin in vite.config.ts
declare module "virtual:licences" {
  const licences: Array<{ name: string; version: string; licence: string }>;
  export default licences;
}
