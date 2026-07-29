import { systemConfig } from "../../core/config/systemConfig";

function Header() {
  return (
    <header className="encabezado">
      <div>
        <span className="marca">
          {systemConfig.app.name}
        </span>

        <h1>Bienvenida, Jefa 👋</h1>

        <p>
          Sistema inteligente de {systemConfig.app.company}
        </p>
      </div>

      <button className="perfil">MJ</button>
    </header>
  );
}

export default Header;