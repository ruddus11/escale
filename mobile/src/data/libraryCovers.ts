// 서재의 인쇄 표지. SVG 원본을 앱과 비교판에서 함께 사용한다.
// 표지 색은 그림 전용이라 화면 팔레트(theme/tokens.ts) 통일의 예외다. 화면 UI 색으로 가져다 쓰지 않는다.
export const libraryCoverIds = ["ogive", "roseWindow", "thorn", "exLibris", "ironwork", "lunar", "folio", "reliquary", "palimpsest", "vespers", "cloister", "astrolabe", "ribbon", "nocturne", "vault", "colophon"] as const;
export type LibraryCoverId = typeof libraryCoverIds[number];
interface CoverPrint {
  background: string;
  ink: string;
  title: { x: number; y: number; width: number; height: number; size: number; align: "left" | "center" };
  dateY: number;
  art: string;
  initial?: { x: number; y: number; size: number; color: string };
}
const path = (d: string, stroke: string, width = 1, fill = "none") => `<path d="${d}" stroke="${stroke}" stroke-width="${width}" fill="${fill}"/>`;
const circle = (x: number, y: number, r: number, stroke: string, width = 1, fill = "none") => `<circle cx="${x}" cy="${y}" r="${r}" stroke="${stroke}" stroke-width="${width}" fill="${fill}"/>`;
const silver = "#C8C7C3", ink = "#202123", bone = "#ECEAE2";
const rose = Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 100 92)">${path("M100 92C73 72 75 39 100 23C125 39 127 72 100 92Z",ink,1.2)}${circle(100,36,3,ink,.7)}</g>`).join("");
const lattice = Array.from({length:5},(_,row)=>Array.from({length:4},(_,col)=>`<g transform="translate(${col*54-8} ${row*42-12})">${path("M27 0C27 17 0 10 0 27C0 44 27 37 27 54C27 37 54 44 54 27C54 10 27 17 27 0Z",ink,1.1)}${path("M0 27H54M27 0V54",ink,.4)}</g>`).join("")).join("");
const thorns = Array.from({length:9},(_,i)=>{const y=24+i*26;return path(`M22 ${y}Q37 ${y+12} 22 ${y+26}M22 ${y+4}L12 ${y-3}M24 ${y+16}L37 ${y+10}`,silver,1.4);}).join("");

export const libraryCoverPrints: Record<LibraryCoverId, CoverPrint> = {
  ogive: {
    background:"#202123",ink:bone,title:{x:28,y:130,width:144,height:65,size:19,align:"center"},dateY:235,
    art:[0,1,2,3].map(i=>path(`M${12+i*10} 270V112Q${12+i*10} ${35+i*12} 100 ${-18+i*16}Q${188-i*10} ${35+i*12} ${188-i*10} 112V270`,silver,i===0?1.8:.7)).join("")+path("M60 218H140",silver,.7),
  },
  roseWindow: {
    background:bone,ink,title:{x:24,y:186,width:152,height:47,size:18,align:"center"},dateY:244,
    art:rose+circle(100,92,76,ink,1.4)+circle(100,92,69,ink,.6)+circle(100,92,15,ink,1.2)+path("M20 172H180",ink,.6),
  },
  thorn: {
    background:"#44272F",ink:"#ECE2DD",title:{x:44,y:98,width:112,height:83,size:20,align:"center"},dateY:224,
    art:thorns+`<g transform="translate(200 270) rotate(180)">${thorns}</g>`+path("M64 39Q100 65 136 39M64 231Q100 205 136 231",silver,.8)+path("M92 42L100 31L108 42L100 53Z",silver,.9),
  },
  exLibris: {
    background:"#D5D3CA",ink,title:{x:43,y:109,width:114,height:58,size:18,align:"center"},dateY:246,
    art:`<ellipse cx="100" cy="131" rx="76" ry="100" fill="none" stroke="${ink}" stroke-width="1.2"/><ellipse cx="100" cy="131" rx="69" ry="93" fill="none" stroke="${ink}" stroke-width=".5"/>`+path("M26 131H13M174 131H187M100 31V15",ink,1)+path("M72 75Q100 43 128 75Q100 64 72 75ZM72 187Q100 219 128 187Q100 198 72 187Z",ink,.8)+circle(100,89,2,ink,1,ink),
  },
  ironwork: {
    background:"#BFC0BC",ink:bone,title:{x:20,y:202,width:160,height:43,size:18,align:"left"},dateY:252,
    art:lattice+`<path d="M0 187H200V270H0Z" fill="${ink}"/>`+path("M19 193H181",silver,.6),
  },
  lunar: {
    background:"#222832",ink:"#E3E5E5",title:{x:24,y:177,width:152,height:53,size:19,align:"left"},dateY:246,
    art:circle(120,79,63,silver,.6)+circle(120,79,48,silver,1)+path("M131 33C76 42 68 109 129 127C95 112 106 53 131 33Z",silver,.7,silver)+path("M17 139L48 117L73 147L167 135M48 117L40 54L63 30",silver,.6)+[ [17,139],[48,117],[73,147],[167,135],[40,54],[63,30] ].map(([x,y])=>circle(x,y,2,silver,.7,"#222832")).join("")+path("M22 24V35M17 29H27",silver,1),
  },
  folio: {
    background:"#E8E5DD",ink,title:{x:63,y:145,width:116,height:64,size:20,align:"left"},dateY:239,
    art:`<path d="M0 0H43V270H0Z" fill="${ink}"/>`+Array.from({length:8},(_,i)=>path(`M12 ${23+i*32}L21 ${12+i*32}L30 ${23+i*32}L21 ${34+i*32}Z`,silver,.7)).join("")+path("M63 28H179M63 34H140M63 220H179",ink,.7),
    initial:{x:65,y:36,size:91,color:ink},
  },
  reliquary: {
    background:"#333635",ink:bone,title:{x:25,y:188,width:150,height:46,size:18,align:"center"},dateY:247,
    art:path("M100 18L165 88L100 165L35 88Z",silver,1.4)+path("M100 30L151 88L100 151L49 88ZM100 18V165M35 88H165M49 88L100 59L151 88L100 118Z",silver,.7)+[ [100,18],[165,88],[100,165],[35,88] ].map(([x,y])=>circle(x,y,4,silver,1,"#333635")).join("")+circle(100,88,18,silver,1.2)+path("M77 88H123M100 65V111",silver,.6),
  },
  palimpsest: {
    background:"#DAD7CF",ink,title:{x:22,y:27,width:156,height:62,size:21,align:"left"},dateY:105,
    art:path("M20 125H180M20 129H180",ink,.6)+path("M180 20V249H20",ink,.8),
    initial:{x:25,y:119,size:148,color:ink},
  },
  vespers: {
    background:"#3B3039",ink:"#E6DDDF",title:{x:22,y:36,width:112,height:82,size:22,align:"left"},dateY:145,
    art:[0,1,2,3,4].map(i=>path(`M${78+i*22} 270V${198-i*9}Q${78+i*22} ${146-i*8} ${220+i*20} ${101-i*16}`,silver,i===0?9:1)).join("")+path("M23 191V245H52",silver,.8),
  },

  cloister: {
    background:bone,ink,title:{x:27,y:26,width:146,height:65,size:21,align:"left"},dateY:109,
    art:`<rect x="0" y="144" width="200" height="126" fill="${ink}"/>`+[0,1,2].map(i=>`<path d="M${17+i*58} 270V204Q${17+i*58} 173 ${42+i*58} 158Q${67+i*58} 173 ${67+i*58} 204V270Z" fill="${bone}"/>`).join("")+path("M27 121H173",ink,.7),
  },
  astrolabe: {
    background:"#263A3C",ink:bone,title:{x:26,y:195,width:148,height:43,size:19,align:"center"},dateY:250,
    art:circle(100,97,73,silver,2)+circle(100,97,64,silver,.6)+circle(100,97,43,silver,1)+Array.from({length:24},(_,i)=>`<g transform="rotate(${i*15} 100 97)">${path(`M100 24V${i%3===0?39:31}`,silver,i%3===0?1.4:.7)}</g>`).join("")+`<g transform="rotate(32 100 97)">${path("M100 37L111 97L100 157L89 97Z",silver,1.2)}${path("M100 37V157",silver,.7)}</g>`+circle(100,97,6,silver,1,"#263A3C")+path("M21 181H179",silver,.6),
  },
  ribbon: {
    background:"#DCD5C7",ink,title:{x:25,y:138,width:119,height:70,size:23,align:"left"},dateY:239,
    art:`<path d="M151 0H180V117L165.5 104L151 117Z" fill="#512E39"/>`+path("M157 0V91M174 0V91",bone,.6)+path("M26 38Q62 2 98 38Q62 78 26 38ZM35 38Q62 15 89 38Q62 65 35 38Z",ink,1)+circle(62,38,8,ink,1)+path("M25 120H130M25 222H175",ink,.7),
  },
  nocturne: {
    background:"#19191F",ink:bone,title:{x:27,y:93,width:146,height:83,size:22,align:"center"},dateY:204,
    art:path("M10 10H190V260H10Z",silver,.8)+path("M17 17H183V253H17Z",silver,.4)+[ [34,36],[166,36],[34,234],[166,234] ].map(([x,y])=>path(`M${x} ${y-12}L${x+3} ${y-3}L${x+12} ${y}L${x+3} ${y+3}L${x} ${y+12}L${x-3} ${y+3}L${x-12} ${y}L${x-3} ${y-3}Z`,silver,.6,silver)).join("")+path("M67 59Q100 81 133 59M67 234Q100 212 133 234",silver,.8),
  },
  vault: {
    background:"#343D34",ink:bone,title:{x:35,y:174,width:130,height:58,size:20,align:"center"},dateY:249,
    art:Array.from({length:9},(_,i)=>path(`M100 154Q${-80+i*45} 112 ${-60+i*40} 0`,silver,i===4?2:.8)).join("")+path("M0 20Q100 76 200 20M0 56Q100 112 200 56M0 92Q100 148 200 92",silver,.6)+circle(100,154,9,silver,1,"#343D34")+circle(100,154,3,silver,1,silver),
  },
  colophon: {
    background:"#E1DED5",ink,title:{x:25,y:158,width:150,height:58,size:22,align:"left"},dateY:240,
    art:`<path d="M0 0H200V10H0ZM0 260H200V270H0ZM123 18H180V135H123Z" fill="${ink}"/>`+path("M132 28H171V119H132Z",silver,.8)+path("M136 109L151.5 94L167 109M136 103L151.5 88L167 103",silver,.7)+path("M25 145H175M25 225H100",ink,.8),
    initial:{x:28,y:24,size:94,color:ink},
  },

};
