export default {
  id: "query-index.settings",
  imports: ["org.dicoogle.sdk.query.QueryIndexSettings"],
  interfaces: ["QueryIndexSettings"],
  methods: [
    {
      name: "getIndexPath",
      signature: "public String getIndexPath()",
      body: ["return properties.getRootDir();"],
    },
    {
      name: "setIndexPath",
      signature: "public void setIndexPath(String path)",
      body: ["properties.setRootDir(path);"],
    },
    {
      name: "isWatchEnabled",
      signature: "public boolean isWatchEnabled()",
      body: ["return properties.isWatchEnabled();"],
    },
    {
      name: "setWatchEnabled",
      signature: "public void setWatchEnabled(boolean watch)",
      body: ["properties.setWatchEnabled(watch);"],
    },
  ],
  testImports: [
    "org.dicoogle.sdk.query.QueryIndexSettings",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertFalse",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "settingsReadAndWriteProperties",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "plugin.setIndexPath(\"./data/custom\");",
        "assertEquals(\"./data/custom\", plugin.getIndexPath());",
        "assertFalse(plugin.isWatchEnabled());",
        "plugin.setWatchEnabled(true);",
        "assertTrue(plugin.isWatchEnabled());",
      ],
    },
    {
      name: "isVisibleAsSettings",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(context -> assertTrue(context.getBeansOfType(QueryIndexSettings.class).size() == 1));",
      ],
    },
  ],
};
