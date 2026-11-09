package fusion.developer.web.cavidades.seguranca;

import jakarta.servlet.http.HttpServletRequest;
import fusion.developer.web.cavidades.config.AppConfig;

public final class SessaoFusion {

    private static final String[] CANDIDATOS_PORTAL_UTIL = {
        "com.neomind.fusion.portal.PortalUtil",
        "com.neomind.portal.PortalUtil",
        "com.neomind.fusion.PortalUtil",
        "br.com.neomind.fusion.portal.PortalUtil"
    };

    private SessaoFusion() {
    }

    public static UsuarioAtual resolver(HttpServletRequest req) {
        String remoteUser = req.getRemoteUser();
        if (remoteUser != null && !remoteUser.isBlank()) {
            return new UsuarioAtual(remoteUser, remoteUser, true, "container");
        }

        try {
            ResultadoPortal rp = portalUtil(req);
            if (rp.resolvido()) {
                return rp.usuario();
            }
        } catch (Exception ignored) {
        }

        String devUser = AppConfig.get("app.dev.usuario");
        if (devUser != null && !devUser.isBlank()) {
            String trim = devUser.trim();
            return new UsuarioAtual(trim, trim, true, "dev");
        }

        return null;
    }

    private static ResultadoPortal portalUtil(HttpServletRequest req) {
        for (String className : CANDIDATOS_PORTAL_UTIL) {
            try {
                ClassLoader loader = req.getServletContext().getClassLoader();
                Class<?> portalUtil = Class.forName(className, true, loader);

                Object usuario = null;
                try {
                    java.lang.reflect.Method getCurrentUser = portalUtil.getMethod("getCurrentUser");
                    usuario = getCurrentUser.invoke(null);
                } catch (Exception ignored) {
                    try {
                        java.lang.reflect.Method setCurrent = portalUtil.getMethod("setCurrentRequest", HttpServletRequest.class);
                        setCurrent.invoke(null, req);
                        java.lang.reflect.Method getCurrentUser2 = portalUtil.getMethod("getCurrentUser");
                        usuario = getCurrentUser2.invoke(null);
                    } catch (Exception ignored2) {
                    }
                }

                if (usuario != null) {
                    UsuarioAtual ua = extrair(usuario);
                    if (ua != null) {
                        return new ResultadoPortal(true, ua);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return new ResultadoPortal(false, null);
    }

    private static UsuarioAtual extrair(Object usuario) {
        if (usuario == null) return null;
        try {
            java.lang.reflect.Method getLogin = usuario.getClass().getMethod("getLogin");
            java.lang.reflect.Method getNome = usuario.getClass().getMethod("getNome");
            java.lang.reflect.Method getAtivo = usuario.getClass().getMethod("isAtivo");
            java.lang.reflect.Method getOrigem = usuario.getClass().getMethod("getOrigem");

            String login = (String) getLogin.invoke(usuario);
            String nome = (String) getNome.invoke(usuario);
            boolean ativo = (Boolean) getAtivo.invoke(usuario);
            String origem = (String) getOrigem.invoke(usuario);

            return new UsuarioAtual(login, nome, ativo, origem);
        } catch (Exception ignored) {
            return null;
        }
    }

    public static class ResultadoPortal {
        private final boolean resolvido;
        private final UsuarioAtual usuario;

        public ResultadoPortal(boolean resolvido, UsuarioAtual usuario) {
            this.resolvido = resolvido;
            this.usuario = usuario;
        }

        public boolean resolvido() {
            return resolvido;
        }

        public UsuarioAtual usuario() {
            return usuario;
        }
    }
}
