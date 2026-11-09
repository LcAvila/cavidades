package fusion.developer.web.cavidades.servlet;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fusion.developer.web.cavidades.seguranca.SessaoFusion;
import fusion.developer.web.cavidades.seguranca.UsuarioAtual;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet(urlPatterns = "/api/usuario-atual")
public class UsuarioAtualServlet extends HttpServlet {

    private final ObjectMapper json = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UsuarioAtual usuario = SessaoFusion.resolver(req);

        ObjectNode node = json.createObjectNode();
        node.put("autenticado", usuario != null);

        if (usuario != null) {
            node.put("login", usuario.login);
            node.put("nome", usuario.nome);
            node.put("ativo", usuario.ativo);
            node.put("origem", usuario.origem);
        } else {
            node.putNull("login");
            node.putNull("nome");
            node.put("ativo", false);
            node.putNull("origem");
        }

        resp.setContentType("application/json;charset=UTF-8");
        json.writeValue(resp.getWriter(), node);
    }
}
