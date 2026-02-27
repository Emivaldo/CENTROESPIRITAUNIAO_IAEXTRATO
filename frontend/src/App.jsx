import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart as LucideLineChart, Wallet, Users, MapPin, Pizza, BarChart, Settings, Check, Folder, Search, X, CheckSquare, BookOpen, Plus, Trash2, ToggleLeft, ToggleRight, Edit2, ChevronLeft, ChevronRight, Save, RefreshCw
} from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import './index.css';

// ─── OVERLAY DE CARREGAMENTO ──────────────────────────────
const LoadingOverlay = ({ title = 'Processando...', subtitle = 'Por favor aguarde.' }) => (
  <div className="loading-overlay">
    <div className="loading-card">
      <div className="loading-spinner" />
      <div className="loading-title">{title}</div>
      <div className="loading-subtitle">{subtitle}</div>
    </div>
  </div>
);

const BRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const inputStyle = {
  textTransform: 'uppercase',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  fontSize: '0.875rem',
  color: 'var(--text-dark)',
  background: 'var(--white)',
  outline: 'none',
  width: '100%'
};

function App() {
  const [data, setData] = useState({ transactions: [], resumo: {}, files_summary: [] });
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [currentMenu, setCurrentMenu] = useState('Dashboard');
  const [uploading, setUploading] = useState(false);
  const [uploadMessages, setUploadMessages] = useState([]);

  // Regras do Extrato
  const [regras, setRegras] = useState([]);
  const emptyRegra = { nome_regra: '', contem_historico: '', contem_detalhes: '', tipo_movimento: '', valores_exatos: '', departamento_destino: '', prioridade: 0 };
  const [novaRegra, setNovaRegra] = useState(emptyRegra);
  const [copiarParaNome, setCopiarParaNome] = useState(false);
  const [editandoRegra, setEditandoRegra] = useState(null);
  const [salvandoRegra, setSalvandoRegra] = useState(false);
  const [regrasSelecionadas, setRegrasSelecionadas] = useState([]);
  const [filtrosRegras, setFiltrosRegras] = useState({ busca: '', departamento: '' });
  const [lancamentosSemDep, setLancamentosSemDep] = useState([]);

  // Departamentos
  const [departamentos, setDepartamentos] = useState([]);
  const emptyDepartamento = { nome: '', tipo: 'misto', ativo: true, faz_parte_movimento: true };
  const [novoDepartamento, setNovoDepartamento] = useState(emptyDepartamento);
  const [editandoDepartamento, setEditandoDepartamento] = useState(null);
  const [salvandoDepartamento, setSalvandoDepartamento] = useState(false);

  // Filtros - Arquivos
  const emptyFiltros = { nome: '', conta: '', mes_ano: '', status: '', data_de: '', data_ate: '' };
  const [filtros, setFiltros] = useState(emptyFiltros);
  const [filtrosAtivos, setFiltrosAtivos] = useState(emptyFiltros);

  const emptyFiltrosLanc = { historico: '', tipo: '', status: '', arquivo: '', data_de: '', data_ate: '' };
  const [filtrosLanc, setFiltrosLanc] = useState(emptyFiltrosLanc);
  const [filtrosLancAtivos, setFiltrosLancAtivos] = useState(emptyFiltrosLanc);
  const [abaLancamentos, setAbaLancamentos] = useState('todos'); // 'todos', 'departamento', 'mesano'
  const [sortFieldLanc, setSortFieldLanc] = useState('data');
  const [sortOrderLanc, setSortOrderLanc] = useState('desc');

  // Filtros - Lançamentos Sem Dep (Pendentes)
  const emptyFiltrosSemDep = { historico: '', detalhes: '', data_de: '', data_ate: '', tipo: '', valor: '', valor_op: '=', valor2: '' };
  const [filtrosSemDep, setFiltrosSemDep] = useState(emptyFiltrosSemDep);
  const [filtrosSemDepAtivos, setFiltrosSemDepAtivos] = useState(emptyFiltrosSemDep);
  const [lancamentosSelecionados, setLancamentosSelecionados] = useState([]);
  const [bulkDepSelecionado, setBulkDepSelecionado] = useState('');
  const [pendentesPage, setPendentesPage] = useState(1);
  const [itemsPerPagePendentes, setItemsPerPagePendentes] = useState(30);
  const [sortFieldPendentes, setSortFieldPendentes] = useState('data');
  const [sortOrderPendentes, setSortOrderPendentes] = useState('desc');

  // Conciliação
  const emptyConcFiltros = { historico: '', detalhes: '', tipo: '', departamento: '', status: '', data_de: '', data_ate: '' };
  const [concFiltros, setConcFiltros] = useState(emptyConcFiltros);
  const [concData, setConcData] = useState({ lancamentos: [], total: 0, page: 1, per_page: 50, total_pages: 0 });
  const [concPage, setConcPage] = useState(1);
  const [concPerPage, setConcPerPage] = useState(50);
  const [concLoading, setConcLoading] = useState(false);
  const [concEditingId, setConcEditingId] = useState(null);
  const [concEditDep, setConcEditDep] = useState('');
  const [concEditStatus, setConcEditStatus] = useState('');
  const [concSaving, setConcSaving] = useState(false);
  const [concSelecionados, setConcSelecionados] = useState([]);
  const [concBulkDep, setConcBulkDep] = useState('');

  // Dashboard - Guias e Filtros
  const [dashAba, setDashAba] = useState('resumo'); // 'resumo', 'anual', 'detalhado'
  const [dashAno, setDashAno] = useState('Todos'); // default
  const [dashConta, setDashConta] = useState('Todas');
  const [dashDepSelecionado, setDashDepSelecionado] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setBackendError(false);
      const response = await axios.get('http://localhost:8000/api/transactions');
      setData(response.data);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setUploadMessages([]);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }
    try {
      const response = await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessages(response.data.results || []);
      e.target.value = null;
      await fetchData();
    } catch (error) {
      console.error("Erro no upload:", error);
      setUploadMessages([{ status: 'error', filename: 'Falha', message: 'Erro na conexão com servidor' }]);
    } finally {
      setUploading(false);
    }
  };

  const [searching, setSearching] = useState(false);

  const handleFiltrar = () => {
    setSearching(true);
    setTimeout(() => {
      setFiltrosAtivos({ ...filtros });
      setSearching(false);
    }, 600);
  };
  const handleLimpar = () => { setFiltros(emptyFiltros); setFiltrosAtivos(emptyFiltros); };

  const handleFiltrarLanc = () => {
    setSearching(true);
    setTimeout(() => {
      setFiltrosLancAtivos({ ...filtrosLanc });
      setSearching(false);
    }, 600);
  };
  const handleLimparLanc = () => { setFiltrosLanc(emptyFiltrosLanc); setFiltrosLancAtivos(emptyFiltrosLanc); };

  const handleFiltrarSemDep = () => {
    setSearching(true);
    setTimeout(() => {
      setFiltrosSemDepAtivos({ ...filtrosSemDep });
      setSearching(false);
    }, 600);
  };
  const handleLimparSemDep = () => {
    setFiltrosSemDep(emptyFiltrosSemDep);
    setFiltrosSemDepAtivos(emptyFiltrosSemDep);
    setPendentesPage(1);
  };

  const handleBulkSubmit = async () => {
    if (lancamentosSelecionados.length === 0) return alert('Selecione ao menos um lançamento.');
    if (!bulkDepSelecionado) return alert('Selecione o departamento destino.');

    setSearching(true);
    try {
      const resp = await axios.post('http://localhost:8000/api/lancamentos/bulk-departamento', {
        lancamento_ids: lancamentosSelecionados,
        departamento_id: parseInt(bulkDepSelecionado)
      });
      const msgRegras = resp.data.regras_criadas > 0 ? ` e ${resp.data.regras_criadas} nova(s) regra(s) de CPF/CNPJ criadas` : '';
      alert(`${resp.data.updated} lançamentos atualizados com sucesso${msgRegras}!`);
      setLancamentosSelecionados([]);
      setBulkDepSelecionado('');
      await fetchLancamentosSemDep();
      await fetchData();
    } catch (e) {
      console.error('Erro ao atualizar em massa', e);
      alert('Erro ao atualizar os lançamentos selecionados.');
    } finally {
      setSearching(false);
    }
  };

  const menuItems = [
    { icon: <Wallet size={18} />, label: "Dashboard" },
    { icon: <Folder size={18} />, label: "Arquivos" },
    { icon: <Users size={18} />, label: "Departamento" },
    { icon: <BookOpen size={18} />, label: "Regras do Extrato" },
    { icon: <CheckSquare size={18} />, label: "Conciliação" },
    { icon: <BarChart size={18} />, label: "Relatórios" },
    { icon: <Settings size={18} />, label: "Configurações" }
  ];

  // ─── EFFECTS DE ROTEAMENTO (EVITA LOOP NO RENDER) ─────
  useEffect(() => {
    let active = true;
    const fetchDeps = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/api/departamentos');
        if (active) setDepartamentos(resp.data || []);
      } catch (e) {
        console.error('Erro ao buscar departamentos', e);
        if (active) setBackendError(true);
      }
    };
    const fetchRegr = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/api/regras');
        if (active) setRegras(resp.data || []);
      } catch (e) {
        console.error('Erro ao buscar regras', e);
        if (active) setBackendError(true);
      }
    };
    const fetchLanc = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/api/lancamentos/sem-departamento');
        if (active) setLancamentosSemDep(resp.data || []);
      } catch (e) {
        console.error('Erro ao buscar lançamentos pendentes', e);
      }
    };

    if (currentMenu === 'Regras do Extrato') {
      if (regras.length === 0) fetchRegr();
      if (departamentos.length === 0) fetchDeps();
      if (lancamentosSemDep.length === 0) fetchLanc();
    } else if (currentMenu === 'Departamento') {
      if (departamentos.length === 0) fetchDeps();
    } else if (currentMenu === 'Conciliação') {
      if (departamentos.length === 0) fetchDeps();
    }

    return () => { active = false; };
  }, [currentMenu, regras.length, departamentos.length, lancamentosSemDep.length]);


  if (loading) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>Carregando...</div>;
  }

  if (backendError) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem', height: '100vh', textAlign: 'center' }}>
        <div style={{ color: 'var(--red)', fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Erro de Conexão com o Servidor</h2>
        <p style={{ color: 'var(--text-muted)' }}>Não foi possível conectar ao Backend. Verifique se a API está rodando (porta 8000).</p>
        <button onClick={() => { setLoading(true); fetchData(); }} style={{ padding: '0.8rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '1rem' }}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const { resumo, transactions, files_summary } = data;
  const currentValStr = BRL(resumo.saldo_geral);
  const receitasStr = BRL(resumo.total_receitas);

  // ─── DASHBOARD ──────────────────────────────────────────
  const renderDashboard = () => {

    // ─── Anos e Contas Disponíveis ───
    const anosDisponiveis = Array.from(new Set(transactions.filter(t => t.faz_parte_movimento !== false && t.data).map(t => {
      const parts = t.data.split('/');
      return parts.length >= 3 ? parts[2].trim().substring(0, 4) : null;
    }).filter(Boolean))).sort().reverse();

    const contasDisponiveis = Array.from(new Set(transactions.filter(t => t.faz_parte_movimento !== false && t.conta).map(t => t.conta))).sort();

    // ─── Dados Base p/ Dashboard ───
    let transacoesMovimento = transactions.filter(t => t.faz_parte_movimento !== false);

    if (dashConta !== 'Todas') {
      transacoesMovimento = transacoesMovimento.filter(t => t.conta === dashConta);
    }
    if (dashAno !== 'Todos') {
      transacoesMovimento = transacoesMovimento.filter(t => {
        if (!t.data) return false;
        const parts = t.data.split('/');
        return parts.length >= 3 && parts[2].trim().substring(0, 4) === dashAno;
      });
    }

    // Aggregations by department (exclui departamentos que não fazem parte do movimento)
    const depAgg = {};

    transacoesMovimento.forEach(t => {
      const dep = t.departamento_destino || 'Sem Departamento';
      if (!depAgg[dep]) depAgg[dep] = { receitas: 0, despesas: 0, count: 0 };
      depAgg[dep].count++;
      if (t.tipo_movimento === 'Despesa') {
        depAgg[dep].despesas += Math.abs(t.valor);
      } else if (t.tipo_movimento === 'Receita') {
        depAgg[dep].receitas += Math.abs(t.valor);
      }
    });

    const dashTabStyles = (tab) => ({
      padding: '0.75rem 1.5rem',
      background: dashAba === tab ? 'white' : 'transparent',
      color: dashAba === tab ? 'var(--primary)' : 'var(--text-muted)',
      borderBottom: dashAba === tab ? '3px solid var(--primary)' : '3px solid transparent',
      cursor: 'pointer',
      fontWeight: dashAba === tab ? 700 : 600,
      fontSize: '0.875rem',
      transition: 'all 0.2s'
    });

    // ─── Dados Anuais ───
    const depAnoData = Object.entries(depAgg).map(([dep, g]) => ({ dep, ...g }));

    // ─── Dados Detalhados ───
    const depsDisponiveis = Array.from(new Set(transacoesMovimento.map(t => t.departamento_destino || 'Sem Departamento'))).sort();

    // Lançamentos específicos do departamento
    const transacoesDep = dashDepSelecionado
      ? transacoesMovimento.filter(t => (t.departamento_destino || 'Sem Departamento') === dashDepSelecionado)
      : [];

    const depDetalhamentoRec = transacoesDep.filter(t => t.tipo_movimento === 'Receita').reduce((s, t) => s + Math.abs(t.valor), 0);
    const depDetalhamentoDesp = transacoesDep.filter(t => t.tipo_movimento === 'Despesa').reduce((s, t) => s + Math.abs(t.valor), 0);
    const depDetalhamentoSaldo = depDetalhamentoRec - depDetalhamentoDesp;

    // Dados do Gráfico de Linha do Departamento
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const depChartData = mesesAbrev.map((m) => ({ name: m, Receitas: 0, Despesas: 0 }));
    transacoesDep.forEach(t => {
      if (!t.data) return;
      const parts = t.data.split('/');
      if (parts.length >= 2) {
        const mIndex = parseInt(parts[1], 10) - 1;
        if (mIndex >= 0 && mIndex <= 11) {
          if (t.tipo_movimento === 'Receita') depChartData[mIndex].Receitas += Math.abs(t.valor);
          else if (t.tipo_movimento === 'Despesa') depChartData[mIndex].Despesas += Math.abs(t.valor);
        }
      }
    });

    const depTableData = Object.entries(depAgg)
      .map(([dep, g]) => ({ ...g, dep, saldo: g.receitas - g.despesas }))
      .sort((a, b) => b.despesas - a.despesas);

    const totalGlobalRec = depTableData.reduce((s, d) => s + d.receitas, 0);
    const totalGlobalDesp = depTableData.reduce((s, d) => s + d.despesas, 0);
    const totalGlobalSaldo = totalGlobalRec - totalGlobalDesp;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="metric-card blue">
            <div className="metric-title">Saldo Geral</div>
            <div className="metric-value">{BRL(totalGlobalSaldo)}</div>
          </div>
          <div className="metric-card green">
            <div className="metric-title">Total Receitas</div>
            <div className="metric-value" style={{ color: 'var(--green)' }}>{BRL(totalGlobalRec)}</div>
          </div>
          <div className="metric-card orange">
            <div className="metric-title">Total Despesas</div>
            <div className="metric-value" style={{ color: 'var(--red)' }}>{BRL(-totalGlobalDesp)}</div>
          </div>
          <div className="metric-card blue2">
            <div className="metric-title">Transações</div>
            <div className="metric-value" style={{ fontSize: '1.6rem' }}>{transacoesMovimento.length}</div>
          </div>
        </div>



        {/* Painel com Abas de Resumo */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f9fafb' }}>
            <div style={dashTabStyles('resumo')} onClick={() => setDashAba('resumo')}>Resumo Acumulado</div>
            <div style={dashTabStyles('anual')} onClick={() => setDashAba('anual')}>Visão Anual</div>
            <div style={dashTabStyles('detalhado')} onClick={() => setDashAba('detalhado')}>Detalhamento por Dep.</div>
          </div>

          <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
            {/* Aba 1: Resumo Acumulado */}
            {dashAba === 'resumo' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#f3f4f6', padding: '1rem', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Ano:</label>
                    <select style={{ ...inputStyle, width: '150px' }} value={dashAno} onChange={e => setDashAno(e.target.value)}>
                      <option value="Todos">Todos os Anos</option>
                      {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Conta Bancária:</label>
                    <select style={{ ...inputStyle, width: '250px' }} value={dashConta} onChange={e => setDashConta(e.target.value)}>
                      <option value="Todas">Todas as Contas</option>
                      {contasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Departamento</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Transações</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Receitas</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Despesas</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depTableData.map((d, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{d.dep}</td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{d.count}</td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{BRL(d.receitas)}</td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{BRL(d.despesas)}</td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700, color: d.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(d.saldo)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '3px solid var(--primary)', background: '#f9fafb' }}>
                      <td style={{ padding: '0.8rem 0.5rem', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>TOTAL GERAL</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{depTableData.reduce((s, d) => s + d.count, 0)}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--green)', fontSize: '0.9rem' }}>{BRL(totalGlobalRec)}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--red)', fontSize: '0.9rem' }}>{BRL(totalGlobalDesp)}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 800, color: totalGlobalSaldo >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '0.9rem' }}>{BRL(totalGlobalSaldo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Aba 2: Visão Anual */}
            {dashAba === 'anual' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', background: '#f3f4f6', padding: '1rem', borderRadius: '8px', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Ano Referência:</label>
                    <select style={{ ...inputStyle, width: '150px' }} value={dashAno} onChange={e => setDashAno(e.target.value)}>
                      <option value="Todos">Todos os Anos</option>
                      {anosDisponiveis.map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Conta Bancária:</label>
                    <select style={{ ...inputStyle, width: '250px' }} value={dashConta} onChange={e => setDashConta(e.target.value)}>
                      <option value="Todas">Todas as Contas</option>
                      {contasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', background: '#fff', padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.875rem', alignItems: 'center' }}>
                    <div>Total Receitas: <span style={{ color: 'var(--green)', marginLeft: '0.3rem' }}>{BRL(depAnoData.reduce((s, d) => s + d.receitas, 0))}</span></div>
                    <div>Total Despesas: <span style={{ color: 'var(--red)', marginLeft: '0.3rem' }}>{BRL(depAnoData.reduce((s, d) => s + d.despesas, 0))}</span></div>
                    <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                      Saldo do Ano:
                      <span style={{
                        color: (depAnoData.reduce((s, d) => s + d.receitas, 0) - depAnoData.reduce((s, d) => s + d.despesas, 0)) >= 0 ? 'var(--green)' : 'var(--red)',
                        marginLeft: '0.3rem',
                        fontWeight: 700
                      }}>
                        {BRL(depAnoData.reduce((s, d) => s + d.receitas, 0) - depAnoData.reduce((s, d) => s + d.despesas, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  {/* Despesas Column */}
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                    <h3 style={{ color: 'var(--red)', borderBottom: '2px solid var(--red)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>↓ Despesas</span>
                      <span>{BRL(depAnoData.reduce((s, d) => s + d.despesas, 0))}</span>
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <tbody>
                        {depAnoData.filter(d => d.despesas > 0).sort((a, b) => b.despesas - a.despesas).map((d, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--text-dark)' }}>{d.dep}</td>
                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{BRL(d.despesas)}</td>
                          </tr>
                        ))}
                        {depAnoData.filter(d => d.despesas > 0).length === 0 && (
                          <tr><td colSpan={2} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma despesa neste ano.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Receitas Column */}
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                    <h3 style={{ color: 'var(--green)', borderBottom: '2px solid var(--green)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>↑ Receitas</span>
                      <span>{BRL(depAnoData.reduce((s, d) => s + d.receitas, 0))}</span>
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <tbody>
                        {depAnoData.filter(d => d.receitas > 0).sort((a, b) => b.receitas - a.receitas).map((d, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--text-dark)' }}>{d.dep}</td>
                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{BRL(d.receitas)}</td>
                          </tr>
                        ))}
                        {depAnoData.filter(d => d.receitas > 0).length === 0 && (
                          <tr><td colSpan={2} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma receita neste ano.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Aba 3: Detalhamento por Dep. */}
            {dashAba === 'detalhado' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#f3f4f6', padding: '1rem', borderRadius: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Selecione o Departamento:</label>
                  <select style={{ ...inputStyle, width: '300px' }} value={dashDepSelecionado || ''} onChange={e => setDashDepSelecionado(e.target.value)}>
                    <option value="">-- Selecione um Departamento --</option>
                    {depsDisponiveis.map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>

                  <span style={{ margin: '0 0.5rem', color: '#ccc' }}>|</span>

                  <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Ano:</label>
                  <select style={{ ...inputStyle, width: '120px' }} value={dashAno} onChange={e => setDashAno(e.target.value)}>
                    <option value="Todos">Todos os Anos</option>
                    {anosDisponiveis.map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>

                  <span style={{ margin: '0 0.5rem', color: '#ccc' }}>|</span>

                  <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-dark)' }}>Conta:</label>
                  <select style={{ ...inputStyle, width: '200px' }} value={dashConta} onChange={e => setDashConta(e.target.value)}>
                    <option value="Todas">Todas as Contas</option>
                    {contasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {dashDepSelecionado ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Resumo Rápido do Departamento */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div className="metric-card green">
                        <div className="metric-title">Receitas do Ano ({dashAno})</div>
                        <div className="metric-value" style={{ color: 'var(--green)' }}>{BRL(depDetalhamentoRec)}</div>
                      </div>
                      <div className="metric-card orange">
                        <div className="metric-title">Despesas do Ano ({dashAno})</div>
                        <div className="metric-value" style={{ color: 'var(--red)' }}>{BRL(depDetalhamentoDesp)}</div>
                      </div>
                      <div className="metric-card blue">
                        <div className="metric-title">Saldo no Ano ({dashAno})</div>
                        <div className="metric-value" style={{ color: depDetalhamentoSaldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(depDetalhamentoSaldo)}</div>
                      </div>
                    </div>

                    {/* Gráfico de Progessão Anual */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#fff' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--text-dark)', margin: '0 0 1rem 0' }}>Progressão de Receitas vs Despesas — {dashDepSelecionado} ({dashAno})</h3>
                      <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={depChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(val) => BRL(val)} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={80} />
                            <Tooltip formatter={(value) => BRL(value)} />
                            <Legend iconType="circle" />
                            <Line type="monotone" dataKey="Receitas" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Tabela de Lançamentos */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', margin: 0 }}>Lançamentos: {dashDepSelecionado}</h3>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, background: 'var(--blue-bg)', color: 'var(--blue)', padding: '0.3rem 0.8rem', borderRadius: '999px' }}>
                          {transacoesDep.length} registros
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.6rem 0.5rem', width: '90px' }}>Data</th>
                            <th style={{ padding: '0.6rem 0.5rem' }}>Histórico</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '100px' }}>Tipo</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '120px' }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transacoesDep.sort((a, b) => {
                            const dA = a.data ? a.data.split('/').reverse().join('-') : '';
                            const dB = b.data ? b.data.split('/').reverse().join('-') : '';
                            return dB.localeCompare(dA); // desc
                          }).map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.data}</td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, textTransform: 'uppercase' }}>{t.historico}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                                  background: t.tipo_movimento === 'Receita' ? 'var(--green-bg)' : 'var(--accent-light)',
                                  color: t.tipo_movimento === 'Receita' ? 'var(--green)' : 'var(--red)'
                                }}>
                                  {t.tipo_movimento === 'Receita' ? '↑ Entr.' : '↓ Saída'}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: t.valor >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {BRL(t.valor)}
                              </td>
                            </tr>
                          ))}
                          {transacoesDep.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Nenhum lançamento encontrado neste ano.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    Selecione um departamento acima para visualizar seus detalhes e lançamentos.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  // ─── ARQUIVOS ──────────────────────────────────────────
  const renderArquivos = () => {
    const arquivosFiltrados = (files_summary || []).filter(file => {
      const okNome = !filtrosAtivos.nome || file.arquivo.toLowerCase().includes(filtrosAtivos.nome.toLowerCase());
      const okConta = !filtrosAtivos.conta || file.conta.toLowerCase().includes(filtrosAtivos.conta.toLowerCase());
      const okMes = !filtrosAtivos.mes_ano || file.mes_ano.includes(filtrosAtivos.mes_ano);
      const okStatus = !filtrosAtivos.status || file.status === filtrosAtivos.status;
      const okDe = !filtrosAtivos.data_de || (file.data_inicial && file.data_inicial >= filtrosAtivos.data_de);
      const okAte = !filtrosAtivos.data_ate || (file.data_final && file.data_final <= filtrosAtivos.data_ate);
      return okNome && okConta && okMes && okStatus && okDe && okAte;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Painel de Filtros */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Search size={16} /> Filtros de Pesquisa
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Nome do Arquivo</label>
              <input style={inputStyle} placeholder="Ex: 2050-8.01..." value={filtros.nome}
                onChange={e => setFiltros(f => ({ ...f, nome: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Conta</label>
              <input style={inputStyle} placeholder="Ex: CENTRO ESPIRITA..." value={filtros.conta}
                onChange={e => setFiltros(f => ({ ...f, conta: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Mês/Ano</label>
              <input style={inputStyle} placeholder="Ex: 01/2024" value={filtros.mes_ano}
                onChange={e => setFiltros(f => ({ ...f, mes_ano: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Status</label>
              <select style={inputStyle} value={filtros.status}
                onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="C">✔ Completo</option>
                <option value="P">⏳ Pendente</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Inicial (a partir de)</label>
              <input type="date" style={inputStyle} value={filtros.data_de}
                onChange={e => setFiltros(f => ({ ...f, data_de: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Final (até)</label>
              <input type="date" style={inputStyle} value={filtros.data_ate}
                onChange={e => setFiltros(f => ({ ...f, data_ate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={handleLimpar} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
              borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <X size={14} /> Limpar
            </button>
            <button onClick={handleFiltrar} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: 'var(--primary)', color: 'white',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Search size={14} /> Pesquisar
            </button>
          </div>
        </div>

        {/* Painel da Grid */}
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-orange" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Folder size={16} /> Arquivos Importados
              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {arquivosFiltrados.length}
              </span>
            </div>
            <label style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              backgroundColor: uploading ? '#e5e7eb' : 'var(--primary)',
              color: uploading ? '#9ca3af' : 'white',
              padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem'
            }}>
              {uploading ? 'Processando...' : '+ Importar PDF(s)'}
              <input type="file" multiple accept=".pdf" style={{ display: 'none' }}
                onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          {uploadMessages.length > 0 && (
            <div style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Resultados da Importação:</h4>
              <ul style={{ fontSize: '0.8rem', listStylePosition: 'inside' }}>
                {uploadMessages.map((msg, i) => (
                  <li key={i} style={{ color: msg.status === 'error' ? 'var(--red)' : 'var(--green)' }}>
                    <strong>{msg.filename}</strong>: {msg.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Nome do Arquivo</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Conta</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Mês/Ano</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Data Inicial</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Data Final</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Saldo Inicial</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Débitos</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Créditos</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {arquivosFiltrados.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum arquivo encontrado.</td></tr>
              ) : arquivosFiltrados.map((file, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{file.arquivo}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{file.conta}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{file.mes_ano}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {file.data_inicial || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', background: file.data_final ? 'var(--green-bg)' : '#f3f4f6', color: file.data_final ? 'var(--green)' : 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {file.data_final || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px',
                      background: file.status === 'C' ? 'var(--green-bg)' : 'var(--accent-light)',
                      color: file.status === 'C' ? 'var(--green)' : 'var(--accent)'
                    }}>
                      {file.status === 'C' ? '✔ Completo' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{BRL(file.saldo_inicial)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{BRL(file.total_debitos)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{BRL(file.total_creditos)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{BRL(file.saldo_final)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── LANÇAMENTOS ──────────────────────────────────────────
  const renderLancamentos = () => {
    const lancFiltrados = (transactions || []).filter(t => {
      const okHist = !filtrosLancAtivos.historico || t.historico.toLowerCase().includes(filtrosLancAtivos.historico.toLowerCase());
      const okTipo = !filtrosLancAtivos.tipo || t.tipo_movimento === filtrosLancAtivos.tipo;
      const okStatus = !filtrosLancAtivos.status || t.status === filtrosLancAtivos.status;
      const okArq = !filtrosLancAtivos.arquivo || t.arquivo.toLowerCase().includes(filtrosLancAtivos.arquivo.toLowerCase());
      // Datas vêm como DD/MM/YYYY, converter para comparação
      const dataISO = t.data ? t.data.split('/').reverse().join('-') : '';
      return okHist && okTipo && okStatus && okArq && okDe && okAte;
    })

    lancFiltrados.sort((a, b) => {
      let valA = a[sortFieldLanc];
      let valB = b[sortFieldLanc];

      if (sortFieldLanc === 'data') {
        valA = a.data ? a.data.split('/').reverse().join('-') : '';
        valB = b.data ? b.data.split('/').reverse().join('-') : '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';

      if (valA < valB) return sortOrderLanc === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrderLanc === 'asc' ? 1 : -1;
      return 0;
    });

    const totalRecFilt = lancFiltrados.filter(t => t.tipo_movimento === 'Receita').reduce((s, t) => s + Math.abs(t.valor), 0);
    const totalDespFilt = lancFiltrados.filter(t => t.tipo_movimento === 'Despesa').reduce((s, t) => s + Math.abs(t.valor), 0);
    const saldoFilt = totalRecFilt - totalDespFilt;

    const renderSortArrowLanc = (field) => {
      if (sortFieldLanc !== field) return null;
      return sortOrderLanc === 'asc' ? ' ↑' : ' ↓';
    };

    const toggleSortLanc = (field) => {
      if (sortFieldLanc === field) {
        setSortOrderLanc(sortOrderLanc === 'asc' ? 'desc' : 'asc');
      } else {
        setSortFieldLanc(field);
        setSortOrderLanc('asc');
      }
    };

    // Agrupamentos
    const agrupado_Dep = {};
    const agrupado_MesAno = {};

    if (abaLancamentos === 'departamento' || abaLancamentos === 'mesano') {
      lancFiltrados.forEach(l => {
        const dpt = l.departamento_destino || 'Sem Departamento';
        const [d, m, y] = (l.data || '//').split('/');
        const mesAnoStr = `${m}/${y}`;
        const valAbs = Math.abs(l.valor);

        if (abaLancamentos === 'departamento') {
          if (!agrupado_Dep[dpt]) agrupado_Dep[dpt] = { receitas: 0, despesas: 0, count: 0 };
          agrupado_Dep[dpt].count++;
          if (l.tipo_movimento === 'Receita') agrupado_Dep[dpt].receitas += valAbs;
          else agrupado_Dep[dpt].despesas += valAbs;
        } else {
          if (!agrupado_MesAno[mesAnoStr]) agrupado_MesAno[mesAnoStr] = { receitas: 0, despesas: 0, count: 0, sortBy: `${y}-${m}` };
          agrupado_MesAno[mesAnoStr].count++;
          if (l.tipo_movimento === 'Receita') agrupado_MesAno[mesAnoStr].receitas += valAbs;
          else agrupado_MesAno[mesAnoStr].despesas += valAbs;
        }
      });
    }

    const tabStyles = (tab) => ({
      padding: '0.75rem 1.5rem',
      background: abaLancamentos === tab ? 'white' : 'transparent',
      color: abaLancamentos === tab ? 'var(--primary)' : 'var(--text-muted)',
      borderBottom: abaLancamentos === tab ? '3px solid var(--primary)' : '3px solid transparent',
      cursor: 'pointer',
      fontWeight: abaLancamentos === tab ? 700 : 600,
      fontSize: '0.875rem'
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Resumo rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="metric-card blue" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Registros Filtrados</div>
            <div className="metric-value" style={{ fontSize: '1.3rem' }}>{lancFiltrados.length}</div>
          </div>
          <div className="metric-card green" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Total C. Receitas</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--green)' }}>{BRL(totalRecFilt)}</div>
          </div>
          <div className="metric-card orange" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Total C. Despesas</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--red)' }}>{BRL(totalDespFilt)}</div>
          </div>
          <div className="metric-card blue2" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Saldo Líquido Período</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: saldoFilt >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(saldoFilt)}</div>
          </div>
        </div>

        {/* Painel de Filtros */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Search size={16} /> Filtros de Lançamentos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Histórico</label>
              <input style={inputStyle} placeholder="Ex: PIX, TED, boleto..." value={filtrosLanc.historico}
                onChange={e => setFiltrosLanc(f => ({ ...f, historico: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo</label>
              <select style={inputStyle} value={filtrosLanc.tipo}
                onChange={e => setFiltrosLanc(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Status</label>
              <select style={inputStyle} value={filtrosLanc.status}
                onChange={e => setFiltrosLanc(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="conciliado">Conciliado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Arquivo Origem</label>
              <input style={inputStyle} placeholder="Ex: 2050-8.01..." value={filtrosLanc.arquivo}
                onChange={e => setFiltrosLanc(f => ({ ...f, arquivo: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data De</label>
              <input type="date" style={inputStyle} value={filtrosLanc.data_de}
                onChange={e => setFiltrosLanc(f => ({ ...f, data_de: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Até</label>
              <input type="date" style={inputStyle} value={filtrosLanc.data_ate}
                onChange={e => setFiltrosLanc(f => ({ ...f, data_ate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={handleLimparLanc} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
              borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <X size={14} /> Limpar
            </button>
            <button onClick={handleFiltrarLanc} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: 'var(--primary)', color: 'white',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Search size={14} /> Pesquisar
            </button>
          </div>
        </div>

        {/* Tab Header e Grid */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f9fafb' }}>
            <div style={tabStyles('todos')} onClick={() => setAbaLancamentos('todos')}>Todos Relacionados</div>
            <div style={tabStyles('departamento')} onClick={() => setAbaLancamentos('departamento')}>Resumo por Departamento</div>
            <div style={tabStyles('mesano')} onClick={() => setAbaLancamentos('mesano')}>Resumo Mensal</div>
          </div>

          <div style={{ padding: '1.5rem', overflowX: 'auto' }}>

            {abaLancamentos === 'todos' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSortLanc('id_codigo')}>
                      #{renderSortArrowLanc('id_codigo')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none', width: '90px' }} onClick={() => toggleSortLanc('data')}>
                      Data{renderSortArrowLanc('data')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSortLanc('historico')}>
                      Histórico{renderSortArrowLanc('historico')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSortLanc('departamento_destino')}>
                      Departamento{renderSortArrowLanc('departamento_destino')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '80px' }} onClick={() => toggleSortLanc('tipo_movimento')}>
                      Tipo{renderSortArrowLanc('tipo_movimento')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: '120px' }} onClick={() => toggleSortLanc('valor')}>
                      Valor{renderSortArrowLanc('valor')}
                    </th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '100px' }} onClick={() => toggleSortLanc('status')}>
                      Status{renderSortArrowLanc('status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lancFiltrados.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum lançamento encontrado.</td></tr>
                  ) : lancFiltrados.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.id_codigo}</td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.data}</td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, textTransform: 'uppercase', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.historico}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 400 }}>{t.arquivo}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--primary)', fontSize: '0.78rem' }}>{t.departamento_destino || '—'}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                          background: t.tipo_movimento === 'Receita' ? 'var(--green-bg)' : 'var(--accent-light)',
                          color: t.tipo_movimento === 'Receita' ? 'var(--green)' : 'var(--red)'
                        }}>
                          {t.tipo_movimento === 'Receita' ? '↑ Entr.' : '↓ Saída'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: t.valor >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {BRL(t.valor)}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                          background: t.status === 'finalizado' ? 'var(--green-bg)' : t.status === 'conciliado' ? 'var(--blue-bg)' : '#fef3c7',
                          color: t.status === 'finalizado' ? 'var(--green)' : t.status === 'conciliado' ? 'var(--blue)' : '#b45309'
                        }}>
                          {t.status === 'finalizado' ? 'Finalizado' : t.status === 'conciliado' ? 'Conciliado' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {abaLancamentos === 'departamento' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Departamento</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Trasações</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Receitas</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Despesas</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(agrupado_Dep).sort((a, b) => b[1].despesas - a[1].despesas).map(([dep, g]) => {
                    const sal = g.receitas - g.despesas;
                    return (
                      <tr key={dep} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 700, color: 'var(--text-dark)' }}>{dep}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{g.count} txs</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{BRL(g.receitas)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{BRL(g.despesas)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700, color: sal >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(sal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {abaLancamentos === 'mesano' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Mês/Ano</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Trasações</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Receitas Totais</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Despesas Totais</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Resultado Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(agrupado_MesAno).sort((a, b) => b[1].sortBy.localeCompare(a[1].sortBy)).map(([ma, g]) => {
                    const sal = g.receitas - g.despesas;
                    return (
                      <tr key={ma} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>{ma}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{g.count} txs</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{BRL(g.receitas)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{BRL(g.despesas)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700, color: sal >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(sal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

          </div>
        </div>

      </div>
    );
  };

  // ─── DEPARTAMENTOS ──────────────────────────────────────────
  const fetchDepartamentos = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/departamentos');
      setDepartamentos(resp.data || []);
    } catch (e) {
      console.error('Erro ao buscar departamentos', e);
      setBackendError(true);
    }
  };

  const handleSalvarDepartamento = async () => {
    setSalvandoDepartamento(true);
    try {
      if (editandoDepartamento) {
        await axios.put(`http://localhost:8000/api/departamentos/${editandoDepartamento}`, novoDepartamento);
      } else {
        await axios.post('http://localhost:8000/api/departamentos', novoDepartamento);
      }
      setNovoDepartamento(emptyDepartamento);
      setEditandoDepartamento(null);
      await fetchDepartamentos();
    } catch (e) {
      console.error('Erro ao salvar departamento', e);
    } finally {
      setSalvandoDepartamento(false);
    }
  };

  const handleDeleteDepartamento = async (id) => {
    if (!confirm('Deseja realmente excluir este departamento?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/departamentos/${id}`);
      await fetchDepartamentos();
    } catch (e) {
      console.error('Erro ao excluir departamento', e);
    }
  };

  const handleToggleDepartamento = async (dep) => {
    try {
      await axios.put(`http://localhost:8000/api/departamentos/${dep.id_codigo}`, { ativo: !dep.ativo });
      await fetchDepartamentos();
    } catch (e) {
      console.error('Erro ao alterar departamento', e);
    }
  };

  const handleEditDepartamento = (dep) => {
    setEditandoDepartamento(dep.id_codigo);
    setNovoDepartamento({
      nome: dep.nome || '',
      tipo: dep.tipo || 'misto',
      ativo: dep.ativo,
      faz_parte_movimento: dep.faz_parte_movimento !== false
    });
  };

  const renderDepartamentos = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Plus size={16} /> {editandoDepartamento ? 'Editar Departamento' : 'Novo Departamento'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Nome do Departamento *</label>
              <input style={inputStyle} placeholder="Ex: CONSTRUÇÃO - Mão de obra" value={novoDepartamento.nome}
                onChange={e => setNovoDepartamento(d => ({ ...d, nome: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo do Departamento *</label>
              <select style={inputStyle} value={novoDepartamento.tipo}
                onChange={e => setNovoDepartamento(d => ({ ...d, tipo: e.target.value }))}>
                <option value="credito">Crédito (Entrada)</option>
                <option value="debito">Débito (Saída)</option>
                <option value="misto">Misto (Ambos)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Faz parte do Movimento? *</label>
              <select style={inputStyle} value={novoDepartamento.faz_parte_movimento ? 'sim' : 'nao'}
                onChange={e => setNovoDepartamento(d => ({ ...d, faz_parte_movimento: e.target.value === 'sim' }))}>
                <option value="sim">✅ Sim — Entra no Dashboard</option>
                <option value="nao">❌ Não — Não entra no Dashboard</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {editandoDepartamento && (
              <button onClick={() => { setEditandoDepartamento(null); setNovoDepartamento(emptyDepartamento); }} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
                borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
              }}>
                <X size={14} /> Cancelar
              </button>
            )}
            <button onClick={handleSalvarDepartamento} disabled={!novoDepartamento.nome || salvandoDepartamento} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: (!novoDepartamento.nome) ? '#e5e7eb' : 'var(--primary)',
              color: (!novoDepartamento.nome) ? '#9ca3af' : 'white',
              cursor: (!novoDepartamento.nome) ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Check size={14} /> {editandoDepartamento ? 'Atualizar Departamento' : 'Salvar Departamento'}
            </button>
          </div>
        </div>

        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} /> Departamentos Cadastrados
              <span style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {departamentos.length}
              </span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}>ID</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Nome do Departamento</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '120px' }}>Tipo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '100px' }}>Movimento</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '60px' }}>Ativo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {departamentos.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum departamento cadastrado.</td></tr>
              ) : departamentos.map((d, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', opacity: d.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{d.id_codigo}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{d.nome}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600,
                      background: d.tipo === 'credito' ? 'var(--green-bg)' : d.tipo === 'debito' ? 'var(--accent-light)' : 'var(--blue-bg)',
                      color: d.tipo === 'credito' ? 'var(--green)' : d.tipo === 'debito' ? 'var(--red)' : 'var(--blue)'
                    }}>
                      {d.tipo === 'credito' ? 'Crédito' : d.tipo === 'debito' ? 'Débito' : 'Misto'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: d.faz_parte_movimento !== false ? 'var(--green-bg)' : '#fef3c7',
                      color: d.faz_parte_movimento !== false ? 'var(--green)' : '#b45309'
                    }}>
                      {d.faz_parte_movimento !== false ? '✅ Sim' : '❌ Não'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleToggleDepartamento(d)}>
                    {d.ativo ? <ToggleRight size={20} color="var(--green)" /> : <ToggleLeft size={20} color="var(--text-muted)" />}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => handleEditDepartamento(d)} style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        Editar
                      </button>
                      <button onClick={() => handleDeleteDepartamento(d.id_codigo)} style={{ background: 'var(--accent-light)', color: 'var(--red)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── REGRAS DO EXTRATO ────────────────────────────────────
  const fetchRegras = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/regras');
      setRegras(resp.data || []);
    } catch (e) {
      console.error('Erro ao buscar regras', e);
      setBackendError(true);
    }
  };

  const fetchLancamentosSemDep = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/lancamentos/sem-departamento');
      setLancamentosSemDep(resp.data || []);
    } catch (e) {
      console.error('Erro ao buscar lançamentos sem departamento', e);
      // No setBackendError required here not to break UI.
    }
  };

  const handleExecutarRegra = async (id) => {
    if (!confirm('Deseja aplicar esta regra aos lançamentos pendentes?')) return;
    setSalvandoRegra(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/regras/${id}/executar`);
      alert(`${res.data.updated} lançamentos conciliados com sucesso!`);
      await fetchLancamentosSemDep();
      await fetchData();
    } catch (e) {
      console.error('Erro ao executar regra', e);
      alert('Erro ao executar a regra. Verifique o console.');
    } finally {
      setSalvandoRegra(false);
    }
  };

  const handleExecutarRegrasSelecionadas = async () => {
    if (regrasSelecionadas.length === 0) return;
    if (!confirm(`Deseja aplicar as ${regrasSelecionadas.length} regras selecionadas aos lançamentos pendentes? Elas serão processadas em cascata.`)) return;
    setSalvandoRegra(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/regras/executar-multiplas`, {
        regra_ids: regrasSelecionadas
      });
      alert(`${res.data.updated} lançamentos conciliados com sucesso pelas regras!`);
      setRegrasSelecionadas([]);
      await fetchLancamentosSemDep();
      await fetchData();
    } catch (e) {
      console.error('Erro ao executar regras', e);
      alert('Erro ao executar as regras. Verifique o console.');
    } finally {
      setSalvandoRegra(false);
    }
  };

  const handleExecutarTodasAsRegras = async () => {
    const regrasAtivasIds = regras.filter(r => r.ativo).map(r => r.id_codigo);
    if (regrasAtivasIds.length === 0) {
      alert("Não existem regras ativas para executar.");
      return;
    }
    if (!confirm(`Deseja aplicar TODAS as ${regrasAtivasIds.length} regras ativas aos lançamentos pendentes?`)) return;
    setSalvandoRegra(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/regras/executar-multiplas`, {
        regra_ids: regrasAtivasIds
      });
      alert(`${res.data.updated} lançamentos conciliados com sucesso por todas as regras!`);
      await fetchLancamentosSemDep();
      await fetchData();
    } catch (e) {
      console.error('Erro ao executar todas as regras', e);
      alert('Erro ao executar todas as regras. Verifique o console.');
    } finally {
      setSalvandoRegra(false);
    }
  };

  const handleSalvarRegra = async () => {
    setSalvandoRegra(true);
    try {
      if (editandoRegra) {
        await axios.put(`http://localhost:8000/api/regras/${editandoRegra}`, novaRegra);
      } else {
        await axios.post('http://localhost:8000/api/regras', novaRegra);
      }
      setNovaRegra(emptyRegra);
      setEditandoRegra(null);
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao salvar regra', e);
    } finally {
      setSalvandoRegra(false);
    }
  };

  const handleDeleteRegra = async (id) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/regras/${id}`);
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao excluir regra', e);
    }
  };

  const handleToggleRegra = async (regra) => {
    try {
      await axios.put(`http://localhost:8000/api/regras/${regra.id_codigo}`, { ativo: !regra.ativo });
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao alterar regra', e);
    }
  };

  const handleEditRegra = (regra) => {
    setEditandoRegra(regra.id_codigo);
    setCopiarParaNome(false);
    setNovaRegra({
      nome_regra: regra.nome_regra || '',
      contem_historico: regra.contem_historico || '',
      contem_detalhes: regra.contem_detalhes || '',
      tipo_movimento: regra.tipo_movimento || '',
      valores_exatos: regra.valores_exatos || '',
      departamento_destino: regra.departamento_destino || '',
      prioridade: regra.prioridade || 0
    });
  };

  const renderRegras = () => {

    const regrasFiltradas = regras.filter(r => {
      let okay = true;
      const tBusca = filtrosRegras.busca.toLowerCase();
      if (tBusca) {
        if (!r.nome_regra.toLowerCase().includes(tBusca) &&
          !(r.contem_historico || '').toLowerCase().includes(tBusca) &&
          !(r.contem_detalhes || '').toLowerCase().includes(tBusca)) {
          okay = false;
        }
      }
      if (filtrosRegras.departamento && r.departamento_destino !== filtrosRegras.departamento) {
        okay = false;
      }
      return okay;
    });

    const lancamentosSemDepFiltrados = lancamentosSemDep.filter(l => {
      if (filtrosSemDepAtivos.historico && !l.historico.toLowerCase().includes(filtrosSemDepAtivos.historico.toLowerCase())) return false;
      if (filtrosSemDepAtivos.detalhes && !((l.detalhes || '').toLowerCase().includes(filtrosSemDepAtivos.detalhes.toLowerCase()))) return false;
      if (filtrosSemDepAtivos.tipo && l.tipo_movimento !== filtrosSemDepAtivos.tipo) return false;
      if (filtrosSemDepAtivos.valor) {
        const valExato = parseFloat(filtrosSemDepAtivos.valor.replace(',', '.'));
        const lValor = Math.abs(l.valor);
        const op = filtrosSemDepAtivos.valor_op || '=';

        if (!isNaN(valExato)) {
          if (op === '=' && lValor !== valExato) return false;
          if (op === '>' && lValor <= valExato) return false;
          if (op === '<' && lValor >= valExato) return false;
          if (op === 'entre') {
            const val2 = parseFloat((filtrosSemDepAtivos.valor2 || '').replace(',', '.'));
            if (!isNaN(val2)) {
              if (lValor < valExato || lValor > val2) return false;
            } else {
              if (lValor !== valExato) return false;
            }
          }
        }
      }
      if (filtrosSemDepAtivos.data_de && l.data) {
        const [d, m, y] = l.data.split('/');
        const lDate = new Date(`${y}-${m}-${d}`);
        const fDate = new Date(filtrosSemDepAtivos.data_de);
        fDate.setUTCHours(0, 0, 0, 0);
        if (lDate < fDate) return false;
      }
      if (filtrosSemDepAtivos.data_ate && l.data) {
        const [d, m, y] = l.data.split('/');
        const lDate = new Date(`${y}-${m}-${d}`);
        const fDate = new Date(filtrosSemDepAtivos.data_ate);
        fDate.setUTCHours(23, 59, 59, 999);
        if (lDate > fDate) return false;
      }
      return true;
    });

    lancamentosSemDepFiltrados.sort((a, b) => {
      let valA = a[sortFieldPendentes];
      let valB = b[sortFieldPendentes];
      if (sortFieldPendentes === 'data') {
        valA = a.data ? a.data.split('/').reverse().join('-') : '';
        valB = b.data ? b.data.split('/').reverse().join('-') : '';
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrderPendentes === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrderPendentes === 'asc' ? 1 : -1;
      return 0;
    });

    const totalPages = Math.ceil(lancamentosSemDepFiltrados.length / itemsPerPagePendentes);
    const startIndex = (pendentesPage - 1) * itemsPerPagePendentes;
    const paginatedLancamentos = lancamentosSemDepFiltrados.slice(startIndex, startIndex + itemsPerPagePendentes);

    const renderSortArrow = (field) => {
      if (sortFieldPendentes !== field) return null;
      return sortOrderPendentes === 'asc' ? ' ↑' : ' ↓';
    };

    const toggleSort = (field) => {
      if (sortFieldPendentes === field) {
        setSortOrderPendentes(sortOrderPendentes === 'asc' ? 'desc' : 'asc');
      } else {
        setSortFieldPendentes(field);
        setSortOrderPendentes('asc');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Formulário de criação/edição */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Plus size={16} /> {editandoRegra ? 'Editar Regra' : 'Nova Regra'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Nome da Regra *</label>
              <input style={inputStyle} placeholder="Ex: Pagamento Emivaldo" value={novaRegra.nome_regra}
                onChange={e => setNovaRegra(r => ({ ...r, nome_regra: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                Departamento Destino *
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto', fontWeight: 500, cursor: 'pointer', color: 'var(--primary)' }}>
                  <input type="checkbox" checked={copiarParaNome} onChange={(e) => {
                    setCopiarParaNome(e.target.checked);
                    if (e.target.checked && novaRegra.departamento_destino) {
                      setNovaRegra(r => ({ ...r, nome_regra: r.departamento_destino }));
                    }
                  }} /> Copiar p/ Nome
                </label>
              </label>
              <select style={inputStyle} value={novaRegra.departamento_destino}
                onChange={e => {
                  const dep = e.target.value;
                  setNovaRegra(r => ({
                    ...r,
                    departamento_destino: dep,
                    nome_regra: copiarParaNome ? dep : r.nome_regra
                  }));
                }}>
                <option value="">Selecione o departamento...</option>
                {departamentos.map(dep => (
                  <option key={dep.id_codigo} value={dep.nome}>{dep.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Prioridade</label>
              <input type="number" style={inputStyle} placeholder="0" value={novaRegra.prioridade}
                onChange={e => setNovaRegra(r => ({ ...r, prioridade: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Condições (preencha uma ou mais)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Contém no Histórico</label>
              <input style={inputStyle} placeholder="Ex: PIX EMIT" value={novaRegra.contem_historico}
                onChange={e => setNovaRegra(r => ({ ...r, contem_historico: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Contém nos Detalhes</label>
              <input style={inputStyle} placeholder="Ex: Emivaldo Júnior" value={novaRegra.contem_detalhes}
                onChange={e => setNovaRegra(r => ({ ...r, contem_detalhes: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo Movimento</label>
              <select style={inputStyle} value={novaRegra.tipo_movimento}
                onChange={e => setNovaRegra(r => ({ ...r, tipo_movimento: e.target.value }))}>
                <option value="">Qualquer</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Valores Exatos (separar por vírgula)</label>
              <input style={inputStyle} placeholder="Ex: 50.00, 60.00" value={novaRegra.valores_exatos}
                onChange={e => setNovaRegra(r => ({ ...r, valores_exatos: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {editandoRegra && (
              <button onClick={() => { setEditandoRegra(null); setNovaRegra(emptyRegra); }} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
                borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
              }}>
                <X size={14} /> Cancelar
              </button>
            )}
            <button onClick={handleSalvarRegra} disabled={!novaRegra.nome_regra || !novaRegra.departamento_destino || salvandoRegra} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? '#e5e7eb' : 'var(--primary)',
              color: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? '#9ca3af' : 'white',
              cursor: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Check size={14} /> {editandoRegra ? 'Atualizar Regra' : 'Salvar Regra'}
            </button>
          </div>
        </div>

        {/* Grid de Regras */}
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={16} /> Regras Cadastradas
              <span style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {regrasFiltradas.length}
              </span>
              {regrasSelecionadas.length > 0 && (
                <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 'bold' }}>
                  {regrasSelecionadas.length} selecionada(s)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={handleExecutarTodasAsRegras} disabled={salvandoRegra} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 1rem', cursor: salvandoRegra ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: salvandoRegra ? 0.7 : 1 }}>
                <CheckSquare size={14} /> Rodar Todas as Regras
              </button>
              {regrasSelecionadas.length > 0 && (
                <button onClick={handleExecutarRegrasSelecionadas} disabled={salvandoRegra} style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 1rem', cursor: salvandoRegra ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: salvandoRegra ? 0.7 : 1 }}>
                  ▶ Executar {regrasSelecionadas.length} em Lote
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}>
              <input style={inputStyle} placeholder="BUSCAR REGRA, HISTÓRICO OU DETALHES..."
                value={filtrosRegras.busca} onChange={e => setFiltrosRegras({ ...filtrosRegras, busca: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ flex: 1 }}>
              <select style={inputStyle} value={filtrosRegras.departamento} onChange={e => setFiltrosRegras({ ...filtrosRegras, departamento: e.target.value })}>
                <option value="">FILTRAR POR DEPARTAMENTO (TODOS)</option>
                {departamentos.map(d => (
                  <option key={d.id_codigo} value={d.nome}>{d.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '30px', textAlign: 'center' }}>
                  <input type="checkbox"
                    checked={regrasFiltradas.length > 0 && regrasSelecionadas.length === regrasFiltradas.length}
                    onChange={(e) => {
                      if (e.target.checked) setRegrasSelecionadas(regrasFiltradas.map(r => r.id_codigo));
                      else setRegrasSelecionadas([]);
                    }}
                  />
                </th>
                <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}>#</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Nome da Regra</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Histórico contém</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Detalhes contém</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Valores</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Departamento</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '60px' }}>Ativo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '180px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {regrasFiltradas.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma regra cadastrada.</td></tr>
              ) : regrasFiltradas.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', opacity: r.ativo ? 1 : 0.5, cursor: 'pointer', background: regrasSelecionadas.includes(r.id_codigo) ? '#f3f4f6' : 'transparent' }} onClick={() => { }}>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }} onClick={(e) => {
                    e.stopPropagation();
                    if (regrasSelecionadas.includes(r.id_codigo)) setRegrasSelecionadas(regrasSelecionadas.filter(id => id !== r.id_codigo));
                    else setRegrasSelecionadas([...regrasSelecionadas, r.id_codigo]);
                  }}>
                    <input type="checkbox" checked={regrasSelecionadas.includes(r.id_codigo)} readOnly />
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }} onClick={() => handleEditRegra(r)}>{r.prioridade}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }} onClick={() => handleEditRegra(r)}>{r.nome_regra}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }} onClick={() => handleEditRegra(r)}>{r.contem_historico || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }} onClick={() => handleEditRegra(r)}>{r.contem_detalhes || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }} onClick={() => handleEditRegra(r)}>{r.tipo_movimento || 'Qualquer'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }} onClick={() => handleEditRegra(r)}>{r.valores_exatos || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--primary)' }} onClick={() => handleEditRegra(r)}>{r.departamento_destino}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleToggleRegra(r); }}>
                    {r.ativo ? <ToggleRight size={20} color="var(--green)" /> : <ToggleLeft size={20} color="var(--text-muted)" />}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => handleExecutarRegra(r.id_codigo)} title="Aplicar regra aos lançamentos pendentes" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        ▶ Executar
                      </button>
                      <button onClick={() => handleEditRegra(r)} style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        Editar
                      </button>
                      <button onClick={() => handleDeleteRegra(r.id_codigo)} style={{ background: 'var(--accent-light)', color: 'var(--red)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grid de Lançamentos Pendentes */}
        <div className="panel" style={{ overflowX: 'auto', border: '1px solid var(--accent)' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pizza size={16} /> Lançamentos Sem Departamento (Pendentes)
              <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {lancamentosSemDepFiltrados.length}
              </span>
            </div>
            <button onClick={fetchLancamentosSemDep} style={{ background: 'var(--white)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Atualizar Lista
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginTop: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Histórico contém</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#9ca3af' }} />
                <input style={{ ...inputStyle, paddingLeft: '1.8rem', fontSize: '0.8rem' }} placeholder="Busca"
                  value={filtrosSemDep.historico} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, historico: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Detalhes contém</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#9ca3af' }} />
                <input style={{ ...inputStyle, paddingLeft: '1.8rem', fontSize: '0.8rem' }} placeholder="Busca"
                  value={filtrosSemDep.detalhes} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, detalhes: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Data De</label>
              <input type="date" style={inputStyle} value={filtrosSemDep.data_de}
                onChange={e => setFiltrosSemDep({ ...filtrosSemDep, data_de: e.target.value })} />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Data Até</label>
              <input type="date" style={inputStyle} value={filtrosSemDep.data_ate}
                onChange={e => setFiltrosSemDep({ ...filtrosSemDep, data_ate: e.target.value })} />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Tipo</label>
              <select style={inputStyle} value={filtrosSemDep.tipo} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, tipo: e.target.value })}>
                <option value="">Qualquer</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Operador de Valor</label>
              <select style={inputStyle} value={filtrosSemDep.valor_op} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, valor_op: e.target.value })}>
                <option value="=">Igual a (=)</option>
                <option value=">">Maior que (&gt;)</option>
                <option value="<">Menor que (&lt;)</option>
                <option value="entre">Entre valores</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{filtrosSemDep.valor_op === 'entre' ? 'Valor De' : 'Valor'}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '8px', top: '7px', color: '#9ca3af', fontSize: '0.85rem' }}>R$</span>
                <input style={{ ...inputStyle, paddingLeft: '2rem', fontSize: '0.8rem' }} placeholder="Ex: 50.00"
                  value={filtrosSemDep.valor} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, valor: e.target.value })} />
              </div>
            </div>
            {filtrosSemDep.valor_op === 'entre' && (
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Valor Até</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '7px', color: '#9ca3af', fontSize: '0.85rem' }}>R$</span>
                  <input style={{ ...inputStyle, paddingLeft: '2rem', fontSize: '0.8rem' }} placeholder="Ex: 100.00"
                    value={filtrosSemDep.valor2} onChange={e => setFiltrosSemDep({ ...filtrosSemDep, valor2: e.target.value })} />
                </div>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', marginTop: '0.2rem' }}>
              <button onClick={handleFiltrarSemDep} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                <Search size={14} /> Filtrar Pendentes
              </button>
              <button onClick={handleLimparSemDep} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', background: '#f3f4f6', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                Limpar Filtros
              </button>
            </div>
          </div>

          {lancamentosSelecionados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fdf2f8', padding: '0.8rem 1rem', borderRadius: '6px', border: '1px solid #fbcfe8', marginTop: '1rem' }}>
              <span style={{ fontWeight: 600, color: '#be185d', fontSize: '0.85rem' }}>{lancamentosSelecionados.length} selecionado(s)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1 }}>
                <select style={{ ...inputStyle, maxWidth: '300px' }} value={bulkDepSelecionado} onChange={(e) => setBulkDepSelecionado(e.target.value)}>
                  <option value="">Aplicar Departamento para os selecionados...</option>
                  {departamentos.map(d => (
                    <option key={d.id_codigo} value={d.id_codigo}>{d.nome}</option>
                  ))}
                </select>
                <button onClick={handleBulkSubmit} disabled={!bulkDepSelecionado} style={{ background: bulkDepSelecionado ? 'var(--primary)' : '#e5e7eb', color: bulkDepSelecionado ? 'white' : '#9ca3af', border: 'none', borderRadius: '4px', padding: '0.45rem 1rem', cursor: bulkDepSelecionado ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.8rem' }}>
                  Aplicar Departamento
                </button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '30px', textAlign: 'center' }}>
                  <input type="checkbox"
                    checked={lancamentosSemDepFiltrados.length > 0 && lancamentosSelecionados.length === lancamentosSemDepFiltrados.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLancamentosSelecionados(lancamentosSemDepFiltrados.map(l => l.id_codigo));
                      } else {
                        setLancamentosSelecionados([]);
                      }
                    }}
                  />
                </th>
                <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('data')}>
                  Data{renderSortArrow('data')}
                </th>
                <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('historico')}>
                  Histórico / Detalhes{renderSortArrow('historico')}
                </th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('tipo_movimento')}>
                  Tipo{renderSortArrow('tipo_movimento')}
                </th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('valor')}>
                  Valor{renderSortArrow('valor')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLancamentos.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum lançamento pendente encontrado.</td></tr>
              ) : paginatedLancamentos.map((l, idx) => (
                <tr key={idx}
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: lancamentosSelecionados.includes(l.id_codigo) ? '#f3f4f6' : 'transparent' }}
                  onClick={() => {
                    setNovaRegra(r => ({
                      ...r,
                      contem_historico: l.historico,
                      contem_detalhes: l.detalhes || '',
                      tipo_movimento: l.tipo_movimento,
                      valores_exatos: l.tipo_movimento === 'Despesa' ? '' : Math.abs(l.valor).toFixed(2)
                    }));
                    setEditandoRegra(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="Clique para preencher a Regra com estes dados"
                >
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox"
                      checked={lancamentosSelecionados.includes(l.id_codigo)}
                      onChange={(e) => {
                        if (e.target.checked) setLancamentosSelecionados([...lancamentosSelecionados, l.id_codigo]);
                        else setLancamentosSelecionados(lancamentosSelecionados.filter(id => id !== l.id_codigo));
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.data}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <div style={{ fontWeight: 600 }}>{l.historico}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.detalhes || 'Sem detalhes'}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: l.tipo_movimento === 'Receita' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {l.tipo_movimento}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 600, color: l.valor >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {BRL(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          {(totalPages > 1 || itemsPerPagePendentes > 30) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Mostrando {lancamentosSemDepFiltrados.length === 0 ? 0 : startIndex + 1} até {Math.min(startIndex + itemsPerPagePendentes, lancamentosSemDepFiltrados.length)} de {lancamentosSemDepFiltrados.length} lançamentos
                <span style={{ marginLeft: '1rem' }}>|</span>
                <select style={{ ...inputStyle, padding: '0.2rem', paddingLeft: '0.4rem', fontSize: '0.8rem' }} value={itemsPerPagePendentes} onChange={e => {
                  setItemsPerPagePendentes(Number(e.target.value));
                  setPendentesPage(1);
                }}>
                  <option value={30}>30 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                  <option value={999999}>Mostrar Todos</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPendentesPage(p => Math.max(1, p - 1))}
                  disabled={pendentesPage === 1}
                  style={{ padding: '0.4rem 0.8rem', background: pendentesPage === 1 ? '#e5e7eb' : 'var(--white)', color: pendentesPage === 1 ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: pendentesPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Anterior
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                  Página {pendentesPage} de {totalPages}
                </div>
                <button
                  onClick={() => setPendentesPage(p => Math.min(totalPages, p + 1))}
                  disabled={pendentesPage === totalPages}
                  style={{ padding: '0.4rem 0.8rem', background: pendentesPage === totalPages ? '#e5e7eb' : 'var(--white)', color: pendentesPage === totalPages ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: pendentesPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

      </div >
    );

  };

  // ─── CONCILIAÇÃO — MANUTENÇÃO DE LANÇAMENTOS ─────────────────
  const fetchConciliacao = async (pageOverride) => {
    setConcLoading(true);
    try {
      const p = pageOverride || concPage;
      const params = new URLSearchParams();
      if (concFiltros.historico) params.append('historico', concFiltros.historico);
      if (concFiltros.detalhes) params.append('detalhes', concFiltros.detalhes);
      if (concFiltros.tipo) params.append('tipo', concFiltros.tipo);
      if (concFiltros.departamento) params.append('departamento', concFiltros.departamento);
      if (concFiltros.status) params.append('status', concFiltros.status);
      if (concFiltros.data_de) params.append('data_de', concFiltros.data_de);
      if (concFiltros.data_ate) params.append('data_ate', concFiltros.data_ate);
      params.append('page', p);
      params.append('per_page', concPerPage);
      const resp = await axios.get(`http://localhost:8000/api/conciliacao/lancamentos?${params.toString()}`);
      setConcData(resp.data);
    } catch (e) {
      console.error('Erro ao buscar conciliação', e);
    } finally {
      setConcLoading(false);
    }
  };

  const handleConcPesquisar = () => {
    setConcPage(1);
    setConcSelecionados([]);
    fetchConciliacao(1);
  };

  const handleConcLimpar = () => {
    setConcFiltros(emptyConcFiltros);
    setConcPage(1);
    setConcSelecionados([]);
    setConcData({ lancamentos: [], total: 0, page: 1, per_page: 50, total_pages: 0 });
  };

  const handleConcPageChange = (newPage) => {
    setConcPage(newPage);
    setConcSelecionados([]);
    fetchConciliacao(newPage);
  };

  const handleConcStartEdit = (lanc) => {
    setConcEditingId(lanc.id_codigo);
    setConcEditDep(lanc.id_departamento || '');
    setConcEditStatus(lanc.status || 'pendente');
  };

  const handleConcCancelEdit = () => {
    setConcEditingId(null);
    setConcEditDep('');
    setConcEditStatus('');
  };

  const handleConcSaveEdit = async (id_codigo) => {
    setConcSaving(true);
    try {
      const payload = {
        id_departamento: concEditDep ? parseInt(concEditDep) : null,
        status: concEditStatus
      };
      await axios.put(`http://localhost:8000/api/lancamentos/${id_codigo}`, payload);
      setConcEditingId(null);
      await fetchConciliacao();
      await fetchData();
    } catch (e) {
      console.error('Erro ao salvar lançamento', e);
      alert('Erro ao salvar as alterações.');
    } finally {
      setConcSaving(false);
    }
  };

  const handleConcBulkSubmit = async () => {
    if (concSelecionados.length === 0) return;
    if (!concBulkDep) {
      alert("Selecione um departamento destino para atualizar os lançamentos selecionados.");
      return;
    }
    setConcSaving(true);
    try {
      await axios.post('http://localhost:8000/api/lancamentos/bulk-departamento', {
        lancamento_ids: concSelecionados,
        departamento_id: parseInt(concBulkDep)
      });
      setConcSelecionados([]);
      setConcBulkDep('');
      await fetchConciliacao();
      await fetchData();
    } catch (e) {
      console.error('Erro no update em massa', e);
      alert('Erro ao atualizar lançamentos em lote.');
    } finally {
      setConcSaving(false);
    }
  };

  const renderConciliacao = () => {
    const { lancamentos, total, page, total_pages } = concData;

    const totalRec = lancamentos.filter(t => t.tipo_movimento === 'Receita').reduce((s, t) => s + t.valor_absoluto, 0);
    const totalDesp = lancamentos.filter(t => t.tipo_movimento === 'Despesa').reduce((s, t) => s + t.valor_absoluto, 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Painel de Filtros */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Search size={16} /> Pesquisa de Lançamentos — Conciliação
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Histórico contém</label>
              <input style={inputStyle} placeholder="Ex: PIX, TED, boleto..." value={concFiltros.historico}
                onChange={e => setConcFiltros(f => ({ ...f, historico: e.target.value.toUpperCase() }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Detalhes contém</label>
              <input style={inputStyle} placeholder="Ex: CPF, CNPJ, nome..." value={concFiltros.detalhes}
                onChange={e => setConcFiltros(f => ({ ...f, detalhes: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo</label>
              <select style={inputStyle} value={concFiltros.tipo}
                onChange={e => setConcFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Departamento</label>
              <select style={inputStyle} value={concFiltros.departamento}
                onChange={e => setConcFiltros(f => ({ ...f, departamento: e.target.value }))}>
                <option value="">Todos</option>
                <option value="__null__">⚠ Sem Departamento</option>
                {departamentos.map(d => (
                  <option key={d.id_codigo} value={d.nome}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Status</label>
              <select style={inputStyle} value={concFiltros.status}
                onChange={e => setConcFiltros(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="conciliado">Conciliado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data De</label>
              <input type="date" style={inputStyle} value={concFiltros.data_de}
                onChange={e => setConcFiltros(f => ({ ...f, data_de: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={handleConcLimpar} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
              borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <X size={14} /> Limpar
            </button>
            <button onClick={handleConcPesquisar} disabled={concLoading} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: 'var(--primary)', color: 'white',
              cursor: concLoading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Search size={14} /> {concLoading ? 'Buscando...' : 'Pesquisar'}
            </button>
          </div>
        </div>

        {/* Resultado */}
        {concData.total > 0 && (
          <>
            {/* Cards resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div className="metric-card blue" style={{ padding: '0.8rem 1rem' }}>
                <div className="metric-title" style={{ fontSize: '0.75rem' }}>Total Encontrados</div>
                <div className="metric-value" style={{ fontSize: '1.2rem' }}>{total}</div>
              </div>
              <div className="metric-card green" style={{ padding: '0.8rem 1rem' }}>
                <div className="metric-title" style={{ fontSize: '0.75rem' }}>Receitas (página)</div>
                <div className="metric-value" style={{ fontSize: '1rem', color: 'var(--green)' }}>{BRL(totalRec)}</div>
              </div>
              <div className="metric-card orange" style={{ padding: '0.8rem 1rem' }}>
                <div className="metric-title" style={{ fontSize: '0.75rem' }}>Despesas (página)</div>
                <div className="metric-value" style={{ fontSize: '1rem', color: 'var(--red)' }}>{BRL(totalDesp)}</div>
              </div>
              <div className="metric-card blue2" style={{ padding: '0.8rem 1rem' }}>
                <div className="metric-title" style={{ fontSize: '0.75rem' }}>Página</div>
                <div className="metric-value" style={{ fontSize: '1rem' }}>{page} / {total_pages}</div>
              </div>
            </div>

            {/* Tabela */}
            <div className="panel" style={{ overflowX: 'auto' }}>
              <div className="panel-header panel-header-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={16} /> Lançamentos para Manutenção
                  <span style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    {total}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.78rem' }} value={concPerPage} onChange={e => {
                    setConcPerPage(Number(e.target.value));
                    setConcPage(1);
                    setConcSelecionados([]);
                    setTimeout(() => fetchConciliacao(1), 100);
                  }}>
                    <option value={30}>30/pág</option>
                    <option value={50}>50/pág</option>
                    <option value={100}>100/pág</option>
                  </select>
                  <button onClick={() => fetchConciliacao()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--white)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                    <RefreshCw size={12} /> Atualizar
                  </button>
                </div>
              </div>

              {/* Barra de Ação em Massa */}
              {concSelecionados.length > 0 && (
                <div style={{ padding: '0.8rem 1rem', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, color: 'var(--blue)', fontSize: '0.85rem' }}>
                    ✅ {concSelecionados.length} lançamento(s) selecionado(s) para aplicação em lote
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontSize: '0.8rem', minWidth: '250px' }} value={concBulkDep} onChange={e => setConcBulkDep(e.target.value)}>
                      <option value="">Selecione o Departamento Destino...</option>
                      {departamentos.map(d => (
                        <option key={d.id_codigo} value={d.id_codigo}>{d.nome}</option>
                      ))}
                    </select>
                    <button onClick={handleConcBulkSubmit} disabled={!concBulkDep || concSaving} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 1rem', cursor: (!concBulkDep || concSaving) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem', opacity: (!concBulkDep || concSaving) ? 0.5 : 1 }}>
                      {concSaving ? 'Aplicando...' : 'Aplicar a Todos'}
                    </button>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 0.4rem', width: '30px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        title="Selecionar todos da página"
                        checked={lancamentos.length > 0 && concSelecionados.length === lancamentos.length}
                        onChange={(e) => {
                          if (e.target.checked) setConcSelecionados(lancamentos.map(l => l.id_codigo));
                          else setConcSelecionados([]);
                        }}
                      />
                    </th>
                    <th style={{ padding: '0.6rem 0.4rem', width: '40px' }}>#</th>
                    <th style={{ padding: '0.6rem 0.4rem', width: '85px' }}>Data</th>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Histórico</th>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Detalhes</th>
                    <th style={{ padding: '0.6rem 0.4rem', width: '200px' }}>Departamento</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: '75px' }}>Tipo</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right', width: '110px' }}>Valor</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: '100px' }}>Status</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: '80px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum lançamento encontrado.</td></tr>
                  ) : lancamentos.map((l) => {
                    const isEditing = concEditingId === l.id_codigo;
                    const isSelected = concSelecionados.includes(l.id_codigo);
                    return (
                      <tr key={l.id_codigo} onClick={() => {
                        if (!isEditing) {
                          if (isSelected) setConcSelecionados(concSelecionados.filter(id => id !== l.id_codigo));
                          else setConcSelecionados([...concSelecionados, l.id_codigo]);
                        }
                      }} style={{ borderBottom: '1px solid var(--border-color)', background: isEditing ? '#eff6ff' : isSelected ? '#f0fdf4' : 'transparent', transition: 'background 0.2s', cursor: isEditing ? 'default' : 'pointer' }}>
                        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setConcSelecionados([...concSelecionados, l.id_codigo]);
                              else setConcSelecionados(concSelecionados.filter(id => id !== l.id_codigo));
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{l.id_codigo}</td>
                        <td style={{ padding: '0.55rem 0.4rem', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{l.data}</td>
                        <td style={{ padding: '0.55rem 0.4rem', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.78rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.historico}>
                          {l.historico}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '1px' }}>{l.arquivo}</div>
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.detalhes || ''}>
                          {l.detalhes || '—'}
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem' }}>
                          {isEditing ? (
                            <select style={{ ...inputStyle, fontSize: '0.8rem', padding: '0.4rem 0.5rem', background: '#fff', width: '100%', borderColor: 'var(--primary)', borderWidth: '2px' }} value={concEditDep}
                              onChange={e => setConcEditDep(e.target.value)}>
                              <option value="">Sem Departamento</option>
                              {departamentos.map(d => (
                                <option key={d.id_codigo} value={d.id_codigo}>{d.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontWeight: 600, color: l.departamento_destino ? 'var(--primary)' : 'var(--red)', fontSize: '0.78rem' }}>
                              {l.departamento_destino || '⚠ Sem Depto'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                            background: l.tipo_movimento === 'Receita' ? 'var(--green-bg)' : 'var(--accent-light)',
                            color: l.tipo_movimento === 'Receita' ? 'var(--green)' : 'var(--red)'
                          }}>
                            {l.tipo_movimento === 'Receita' ? '↑ Entr.' : '↓ Saída'}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', fontWeight: 700, color: l.valor >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '0.82rem' }}>
                          {BRL(l.valor)}
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center' }}>
                          {isEditing ? (
                            <select style={{ ...inputStyle, fontSize: '0.72rem', padding: '0.25rem 0.3rem', background: '#fff' }} value={concEditStatus}
                              onChange={e => setConcEditStatus(e.target.value)}>
                              <option value="pendente">Pendente</option>
                              <option value="conciliado">Conciliado</option>
                              <option value="finalizado">Finalizado</option>
                            </select>
                          ) : (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                              background: l.status === 'finalizado' ? 'var(--green-bg)' : l.status === 'conciliado' ? 'var(--blue-bg)' : '#fef3c7',
                              color: l.status === 'finalizado' ? 'var(--green)' : l.status === 'conciliado' ? 'var(--blue)' : '#b45309'
                            }}>
                              {l.status === 'finalizado' ? 'Finalizado' : l.status === 'conciliado' ? 'Conciliado' : 'Pendente'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                              <button onClick={() => handleConcSaveEdit(l.id_codigo)} disabled={concSaving}
                                style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Save size={11} /> Salvar
                              </button>
                              <button onClick={handleConcCancelEdit}
                                style={{ background: '#f3f4f6', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem' }}>
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => handleConcStartEdit(l)}
                              style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem', margin: '0 auto' }}>
                              <Edit2 size={11} /> Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginação */}
              {total_pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.75rem 0', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Mostrando {((page - 1) * concPerPage) + 1} até {Math.min(page * concPerPage, total)} de <strong>{total}</strong> lançamentos
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleConcPageChange(1)}
                      disabled={page <= 1}
                      style={{ padding: '0.35rem 0.6rem', background: page <= 1 ? '#e5e7eb' : 'var(--white)', color: page <= 1 ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      Primeira
                    </button>
                    <button
                      onClick={() => handleConcPageChange(page - 1)}
                      disabled={page <= 1}
                      style={{ padding: '0.35rem 0.5rem', background: page <= 1 ? '#e5e7eb' : 'var(--white)', color: page <= 1 ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}>
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ padding: '0 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>Pág {page} de {total_pages}</span>
                    <button
                      onClick={() => handleConcPageChange(page + 1)}
                      disabled={page >= total_pages}
                      style={{ padding: '0.35rem 0.5rem', background: page >= total_pages ? '#e5e7eb' : 'var(--white)', color: page >= total_pages ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: page >= total_pages ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => handleConcPageChange(total_pages)}
                      disabled={page >= total_pages}
                      style={{ padding: '0.35rem 0.6rem', background: page >= total_pages ? '#e5e7eb' : 'var(--white)', color: page >= total_pages ? '#9ca3af' : 'var(--text-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: page >= total_pages ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      Última
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Estado vazio: antes de pesquisar */}
        {concData.total === 0 && !concLoading && (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <CheckSquare size={40} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-dark)', margin: '0 0 0.5rem 0' }}>Pesquise os Lançamentos</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
              Use os filtros acima e clique em <strong>Pesquisar</strong> para listar os lançamentos.
              Você poderá editar o departamento e o status de cada lançamento diretamente na tabela.
            </p>
          </div>
        )}
      </div>
    );
  };


  // ─── LAYOUT PRINCIPAL ──────────────────────────────────────────
  return (
    <>
      {uploading && <LoadingOverlay title="Importando arquivo..." subtitle="Estamos lendo o PDF e gravando os lançamentos no banco de dados." />}
      {searching && <LoadingOverlay title="Pesquisando..." subtitle="Filtrando os arquivos conforme os critérios informados." />}
      {salvandoDepartamento && <LoadingOverlay title="Salvando Departamento..." subtitle="Aguarde enquanto registramos o departamento no banco." />}
      {salvandoRegra && <LoadingOverlay title="Salvando Regra..." subtitle="Aguarde enquanto registramos a regra no banco." />}
      {concLoading && <LoadingOverlay title="Pesquisando Lançamentos..." subtitle="Aguarde, processando filtros de conciliação." />}
      {concSaving && <LoadingOverlay title="Salvando Alteração..." subtitle="Aguarde, atualizando o departamento do lançamento." />}
      <div className="app-container">
        <aside className="sidebar">
          <div className="logo-container">
            <div className="logo-icon"><LucideLineChart size={20} /></div>
            <div className="logo-text">
              <h1>Centro Espírita União</h1>
              <div className="logo-sub">Controle Financeiro</div>
            </div>
          </div>
          <ul className="nav-links">
            {menuItems.map((item, idx) => (
              <li className="nav-item" key={idx} onClick={() => setCurrentMenu(item.label)} style={{ cursor: 'pointer' }}>
                <a className={`nav-link ${currentMenu === item.label ? 'active' : ''}`}>
                  {item.icon}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          <header className="header">
            <div>
              <div className="header-title">
                <h2>{currentMenu === 'Dashboard' ? 'Dashboard Financeiro CEU' : currentMenu}</h2>
              </div>
              <div className="header-subtitle">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div className="header-badge">
              <Wallet size={16} /> Valor atual: <span>{currentValStr}</span>
            </div>
          </header>

          {currentMenu === 'Dashboard' && renderDashboard()}
          {currentMenu === 'Arquivos' && renderArquivos()}
          {currentMenu === 'Lançamentos' && renderLancamentos()}
          {currentMenu === 'Regras do Extrato' && renderRegras()}
          {currentMenu === 'Departamento' && renderDepartamentos()}
          {currentMenu === 'Conciliação' && renderConciliacao()}
          {!['Dashboard', 'Arquivos', 'Lançamentos', 'Regras do Extrato', 'Departamento', 'Conciliação'].includes(currentMenu) && (
            <div className="panel">
              <div className="panel-header panel-header-orange">Em construção</div>
              <p style={{ color: 'var(--text-muted)' }}>A tela de {currentMenu} será implementada em breve.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
