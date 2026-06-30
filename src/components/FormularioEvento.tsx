import { useState, useEffect } from "react";
import { Evento } from "../types";
import { getDiaSemana } from "../utils/dateUtils";
import "./FormularioEvento.css";

/**
 * Props do formulário de evento.
 * `evento` nulo indica modo de criação.
 */
interface FormularioEventoProps {
  evento: Evento | null;
  onSalvar: (evento: Evento) => Promise<void>;
  onCancelar: () => void;
}

/**
 * Formulário controlado para criação/edição de eventos.
 * Mantém estado local para evitar mutações diretas no objeto original.
 */
const FormularioEvento = ({
  evento,
  onSalvar,
  onCancelar,
}: FormularioEventoProps) => {
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    nomeEvento: "",
    adicionadoPor: "",
    dataHora: "",
    localEvento: "",
    funcionarioPlantao: "",
    plantaoEventos: "",
    equipamentosNecessarios: "",
    numeroChamado: "",
    requerente: "",
    prioridade: "",
  });

  useEffect(() => {
    // Pré-preenche o formulário quando estamos em modo de edição.
    if (evento) {
      // Converte a data salva (UTC) para o fuso local do usuário no formato YYYY-MM-DDTHH:mm
      const data = new Date(evento.dataHora);
      const pad = (n: number) => String(n).padStart(2, "0");
      const dataHoraFormatada = `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
      
      setFormData({
        nomeEvento: evento.nomeEvento,
        adicionadoPor: evento.adicionadoPor || "",
        dataHora: dataHoraFormatada,
        localEvento: evento.localEvento,
        funcionarioPlantao: evento.funcionarioPlantao,
        plantaoEventos: evento.plantaoEventos || "",
        equipamentosNecessarios: evento.equipamentosNecessarios,
        numeroChamado: evento.numeroChamado,
        requerente: evento.requerente || "",
        prioridade: evento.prioridade || "",
      });
    } else {
      setFormData({
        nomeEvento: "",
        adicionadoPor: "",
        dataHora: "",
        localEvento: "",
        funcionarioPlantao: "",
        plantaoEventos: "",
        equipamentosNecessarios: "",
        numeroChamado: "",
        requerente: "",
        prioridade: "",
      });
    }
  }, [evento]);

  useEffect(() => {
    // Atalho para fechar o formulário sem cliques.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancelar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancelar]);

  /**
   * Atualiza campos do formulário de forma genérica.
   * Isso evita criar handlers específicos para cada input.
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Valida campos obrigatórios e monta o objeto de domínio para persistência.
   *
   * @param e Evento de submit do formulário.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;

    if (!formData.nomeEvento || !formData.dataHora || !formData.localEvento) {
      alert(
        "Por favor, preencha pelo menos Nome do Evento, Data e Hora, e Local do Evento.",
      );
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        id: evento?.id || "",
        nomeEvento: formData.nomeEvento,
        adicionadoPor: formData.adicionadoPor,
        dataHora: new Date(formData.dataHora).toISOString(),
        diaSemana: getDiaSemana(formData.dataHora),
        localEvento: formData.localEvento,
        funcionarioPlantao: formData.funcionarioPlantao,
        plantaoEventos: formData.plantaoEventos,
        equipamentosNecessarios: formData.equipamentosNecessarios,
        numeroChamado: formData.numeroChamado,
        requerente: formData.requerente,
        prioridade: formData.prioridade as "urgente" | "alta" | "média" | "baixa" | undefined,
        removido: false,
        concluido: evento?.concluido || false,
        dataConclusao: evento?.dataConclusao,
      });
    } catch {
      setSalvando(false);
    }
  };

  return (
    <div className="formulario-overlay">
      <div className="formulario-container">
        <h3>{evento ? "Editar Evento" : "Adicionar Novo Evento"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nomeEvento">Nome do Evento *</label>
            <input
              type="text"
              id="nomeEvento"
              name="nomeEvento"
              value={formData.nomeEvento}
              onChange={handleChange}
              required
              placeholder="Ex: Montagem de som para evento corporativo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dataHora">Data e Hora *</label>
            <input
              type="datetime-local"
              id="dataHora"
              name="dataHora"
              min="1000-01-01T00:00"
              max="9999-12-31T23:59"
              value={formData.dataHora}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="localEvento">Local do Evento *</label>
            <input
              type="text"
              id="localEvento"
              name="localEvento"
              value={formData.localEvento}
              onChange={handleChange}
              required
              placeholder="Ex: Auditório Principal"
            />
          </div>

          <div className="form-group">
            <label htmlFor="funcionarioPlantao">Plantão TI</label>
            <input
              type="text"
              id="funcionarioPlantao"
              name="funcionarioPlantao"
              value={formData.funcionarioPlantao}
              onChange={handleChange}
              placeholder="Ex: João Silva"
            />
          </div>

          <div className="form-group">
            <label htmlFor="plantaoEventos">Plantão Eventos</label>
            <input
              type="text"
              id="plantaoEventos"
              name="plantaoEventos"
              value={formData.plantaoEventos}
              onChange={handleChange}
              placeholder="Ex: Maria Souza"
            />
          </div>

          <div className="form-group">
            <label htmlFor="equipamentosNecessarios">
              Equipamentos Necessários
            </label>
            <textarea
              id="equipamentosNecessarios"
              name="equipamentosNecessarios"
              value={formData.equipamentosNecessarios}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: 2 caixas de som, 1 mixer, 4 microfones, cabos..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="numeroChamado">Número do Chamado</label>
            <input
              type="text"
              id="numeroChamado"
              name="numeroChamado"
              value={formData.numeroChamado}
              onChange={handleChange}
              placeholder="Ex: CH-2024-001"
            />
          </div>

          <div className="form-group">
            <label htmlFor="requerente">Requerente</label>
            <input
              type="text"
              id="requerente"
              name="requerente"
              value={formData.requerente}
              onChange={handleChange}
              placeholder="Ex: Departamento Financeiro"
            />
          </div>

          <div className="form-group">
            <label htmlFor="prioridade">Prioridade</label>
            <select
              id="prioridade"
              name="prioridade"
              value={formData.prioridade}
              onChange={handleChange}
            >
              <option value="">Nenhuma</option>
              <option value="baixa">Baixa</option>
              <option value="média">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="form-buttons">
            <button type="button" className="btn-cancelar" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className="btn-salvar" disabled={salvando}>
              {salvando ? "Salvando..." : evento ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioEvento;
