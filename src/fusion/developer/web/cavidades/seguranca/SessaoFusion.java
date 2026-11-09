package fusion.developer.web.cavidades.seguranca;

import fusion.developer.web.cavidades.config.AppConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public final class SessaoFusion {

    private static final String[] CANDIDATOS_PORTAL_UTIL = {
        "com.neomind.fusion.portal.PortalUtil",
        "com.neomind.portal.PortalUtil",
        "com.neomind.fusion.PortalUtil",
        "br.com.neomind.fusion.portal.PortalUtil"
    };

    private static final String[] METODOS_USUARIO = {
        "getCurrentUser", "getUser", "getCurrentNeoUser"
    };

    private SessaoFusion() {
    }

    public static UsuarioAtual resolver(HttpServletRequest req) {
        try {
            String remoteUser = req.getRemoteUser();
            if (remoteUser != null && !remoteUser.isBlank()) {
                return new UsuarioAtual(remoteUser, remoteUser, true, "container");
            }
        } catch (Exception ignored) {
        }

        ResultadoPortal resultado = portalUtil(req);
        if (resultado.resolvido()) {
            return resultado.usuario();
        }

        String dev = AppConfig.get("app.dev.usuario");
        if (dev != null && !dev.isBlank()) {
            String login = dev.trim();
            return new UsuarioAtual(login, login, true, "dev");
        }

        return null;
    }

    private static ResultadoPortal portalUtil(HttpServletRequest req) {
        ClassLoader fusionLoader = null;
        try {
            ServletContext fusion = req.getServletContext().getContext("/fusion");
            if (fusion != null) {
                fusionLoader = fusion.getClassLoader();
            }
        } catch (Exception ignored) {
        }

        List<String> candidatos = new ArrayList<>();
        try {
            String configurado = AppConfig.get("app.fusion.portal-util-class");
            if (configurado != null && !configurado.isBlank()) {
                candidatos.add(configurado.trim());
            }
        } catch (Exception ignored) {
        }
        for (String candidato : CANDIDATOS_PORTAL_UTIL) {
            candidatos.add(candidato);
        }

        for (String nome : candidatos) {
            Class<?> portalUtil = carregar(nome, fusionLoader);
            if (portalUtil == null) {
                continue;
            }
            for (String metodoNome : METODOS_USUARIO) {
                for (Method metodo : portalUtil.getMethods()) {
                    if (!metodo.getName().equals(metodoNome)) {
                        continue;
                    }
                    Object usuario = invocar(metodo, req);
                    if (usuario == null) {
                        continue;
                    }
                    UsuarioAtual atual = extrair(usuario);
                    if (atual != null) {
                        return new ResultadoPortal(atual, true);
                    }
                }
            }
        }

        return new ResultadoPortal(null, false);
    }

    private static Class<?> carregar(String nome, ClassLoader loader) {
        try {
            return Class.forName(nome, true, loader);
        } catch (Throwable ignored) {
        }
        try {
            return Class.forName(nome);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static Object invocar(Method metodo, HttpServletRequest req) {
        Class<?>[] parametros = metodo.getParameterTypes();
        try {
            if (parametros.length == 0) {
                return metodo.invoke(null);
            }
            if (parametros.length == 1
                && (parametros[0].isAssignableFrom(HttpServletRequest.class)
                    || parametros[0].isAssignableFrom(ServletRequest.class))) {
                return metodo.invoke(null, req);
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    private static UsuarioAtual extrair(Object usuario) {
        if (usuario == null) {
            return null;
        }
        String login = primeiroTexto(
            usuario, "getLogin", "getUserName", "getUsername", "getEmail");
        String nome = primeiroTexto(
            usuario, "getName", "getNome", "getNomeCompleto", "getFullName");
        boolean ativo = primeiroBooleano(
            usuario, true, "isActive", "isAtivo", "getAtivo");
        return new UsuarioAtual(login, nome, ativo, "fusion");
    }

    private static String primeiroTexto(Object alvo, String... metodos) {
        for (String nome : metodos) {
            try {
                Method metodo = alvo.getClass().getMethod(nome);
                Object valor = metodo.invoke(alvo);
                String texto = valor == null ? null : String.valueOf(valor);
                if (texto != null && !texto.isBlank()) {
                    return texto.trim();
                }
            } catch (Throwable ignored) {
            }
        }
        return null;
    }

    private static boolean primeiroBooleano(
            Object alvo, boolean padrao, String... metodos) {
        for (String nome : metodos) {
            try {
                Method metodo = alvo.getClass().getMethod(nome);
                Object valor = metodo.invoke(alvo);
                if (valor instanceof Boolean) {
                    return (Boolean) valor;
                }
            } catch (Throwable ignored) {
            }
        }
        return padrao;
    }

    public static final class ResultadoPortal {
        private final UsuarioAtual usuario;
        private final boolean resolvido;

        ResultadoPortal(UsuarioAtual usuario, boolean resolvido) {
            this.usuario = usuario;
            this.resolvido = resolvido;
        }

        public boolean resolvido() {
            return resolvido;
        }

        public UsuarioAtual usuario() {
            return usuario;
        }
    }
}
