// Registra um DOM global para o `bun test`, permitindo testar componentes React.
// Carregado por `[test] preload` no bunfig.toml — não importar manualmente.
//
// happy-dom em vez de jsdom: é o caminho documentado do Bun (o registrador
// oficial instala os globais no mesmo processo, sem ambiente separado) e é
// bem mais leve. Não precisamos de nada que só o jsdom oferece.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
