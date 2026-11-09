package fusion.developer.web.cavidades.config;

import java.io.InputStream;
import java.util.Properties;

public final class AppConfig {

    private static final Properties P = new Properties();

    private AppConfig() {
    }

    public static String get(String key) {
        String env = System.getenv(
            key.toUpperCase().replace('.', '_').replace('-', '_')
        );
        if (env != null && !env.isBlank()) {
            return env;
        }
        return P.getProperty(key);
    }

    public static String required(String key) {
        String valor = get(key);
        if (valor == null || valor.isBlank()) {
            throw new IllegalStateException(
                "Propriedade obrigatoria nao configurada: " + key
            );
        }
        return valor;
    }

    static {
        try (InputStream in = AppConfig.class.getClassLoader()
                .getResourceAsStream("application.properties")) {
            if (in != null) {
                P.load(in);
            }
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
