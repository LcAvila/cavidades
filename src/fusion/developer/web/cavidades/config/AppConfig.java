package fusion.developer.web.cavidades.config;

public final class AppConfig {

    private AppConfig() {
    }

    public static String get(String key) {
        return System.getProperty(key);
    }
}
