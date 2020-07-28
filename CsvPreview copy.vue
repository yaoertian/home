<template>
  <el-dialog
    :title="`CSVファイルのプロパティを設定してください`"
    :visible.sync="$props.dialogVisible"
    width="1200px" height="800px">
    <el-row class="fb fb-v-center">
      <el-col :span="12">
        <div>
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "列名行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="headlines" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(0~999、0は列名行なし)" }}</el-col>
        </el-row>
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "属性行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="attrlines" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(0~999、0は属性行行なし)" }}</el-col>
        </el-row> 
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "データ開始行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="datastart" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(列名行と属性行以降の数字)" }}</el-col>
        </el-row> 
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "区切り記号：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle hint-mark"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="cutsign" :maxlength="50"></el-input></el-col>
          <el-col :span="10">{{ "(,や;等の記号。タプは\t)" }}</el-col>
        </el-row> 
        </div>
      </el-col>
      <el-col :span="12">
          <div id="ranking" ref="ranking" class="el-tab-canvas" style="height:250px;"></div> 
      </el-col>
    </el-row>  
    <br>
    <div>
    <el-row class="fb fb-v-center">
       <el-col style="text-align: left;" :span="20">
         CSVプレビュー(100行まで表示)<input type="file" id="files" multiple="" accept=".csv" style="margin-left:10px;" @change="onSelect()">{{fileinfo}}
       </el-col>
       <el-col style="text-align: right;" :span="4">
         <el-button size="small" style="width:185px" @click="reload()">プロパティのリロード</el-button>
       </el-col>
    </el-row> 
    <el-row>
      <div @drop="onDrop($event)" @dragleave="dragleave($event)" @dragover="dragover($event)" @dragenter="dragenter($event)" v-loading="fileloading">   
        <el-table :data="csvData" stripe style="width: 100%;border: 1px solid rgb(220, 223, 230);" height="250">
          <el-table-column
            v-for="(column, index) in columns"
            :fixed="index == 0"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
            :width="column.width"
          ></el-table-column>
        </el-table>
      </div> 
    </el-row>
    <el-row style="padding:10px;">
       <el-col :span="16" >
          <label >{{ hint }}</label>
          <el-progress :percentage="uploadProgress" v-show="uploading"></el-progress>&nbsp;
       </el-col>     
       <el-col style="text-align: right;" :span="8">
       <el-button size="small" style="width:150px" @click="upload()">確定</el-button>
       <el-button size="small" style="width:150px"  @click="cancel()">キャンセル</el-button>
       </el-col>
    </el-row>    

    </div>
  </el-dialog>
</template>

<script>
import api from "~/api/api";
import Papa from "papaparse";
import $ from "jquery";
import uuid from "uuid";
const echarts = require('echarts/lib/echarts');
require('echarts/lib/chart/line');
const encoding = require('encoding-japanese');
const SNIFF_DEPTH = 10;
const CONCURENT_MAX = 4;
const CHUNCK_SIZE = 1048576;
//const CHUNCK_SIZE = 524288;
//const CHUNCK_SIZE = 2097152;
//const CHUNCK_SIZE = 3145728;
//err const CHUNCK_SIZE = 5242880;
const CHK_LIST = [
    {type:"BIGINT", reg:/^-?\d+$/},
    {type:"DECIMAL(38,18)", reg:/^-?\d*\.\d+$/},  
    {type:"DATE", reg:/^\d{4}-\d{1,2}-\d{1,2}$/},              
    {type:"TIMESTAMP", reg:/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}$/},
    {type:"BOOLEAN", reg:/^(true|false)$/i}
  ];

export default {
  data() {
    return {
      charset: 'utf-8',
      rowcount:0,
      fileloading: false,
      csvfile: undefined,
      tableName: undefined,
      fileinfo: '',
      filesize: '',
      uploading: false,
      hasError: false,
      hint: '',
      chunkNo: 0,
      headlines: 1,
      attrlines: 2,
      datastart: 3,
      cutsign: ",",
      columns: [],
      dataTypes: [],
      csvData: [],
      markTime: undefined,
      chunkList:[],
      speedList:[],
      stopflg: undefined,
      concount:0,
      startTime: undefined,
      costTime:'',
      pauseFlg: false
    };
  },
  props: {
    eChartData: Object,
    dialogVisible: Boolean
  },
  created() {
    this.initData();
  },
  mounted() {},
  computed: {
   
    chunks: {
      get() {
          return Math.ceil(this.filesize / CHUNCK_SIZE);
      }, 
    },    
    uploadProgress: {
      get() {
          //return 50;
          if (this.filesize == 0){
            return 0;
          } else {
            return Math.floor(this.chunkNo * 100/ this.chunks);
          }
      }
    },   
  },
  
  methods: {
    initData(){
      this.rowcount =0;
      this.csvfile = undefined;
      this.tableName = undefined;
      this.filesize = 0;
      this.chunkNo = 0;
      this.headlines = 1;
      this.attrlines = 2;
      this.datastart = 3;
      this.cutsign = ",";   
      this.columns = [];
      this.csvData = [];
      this.dataTypes = [];
    },

  drawChart() {
      this.$nextTick(async () => {
        let rankingChart = echarts.init(this.$refs.ranking);
        rankingChart.setOption({
          xAxis: {
              type: 'category',
              data: this.chunkList
          },
          yAxis: {
              type: 'value'
          },
          series: [{
              data: this.speedList,
              type: 'line'
          }]
        });
      }); 
    },    
    
    dragenter(e){
      e.preventDefault();  
    },
    dragover(e){
       e.preventDefault();
    },
    dragleave(e){
       e.preventDefault();
    }, 

    // guess charset of csv
    async getEncoding(file) {
        return new Promise(resolve => {
          let reader = new FileReader();  
          reader.onload = function(e){
              let buf = new Uint8Array(e.target.result);
              // console.log(buf[0].toString(16));
              let gs = encoding.detect(buf);
              // console.log(gs);
              resolve(gs);
          } 
          reader.readAsArrayBuffer(file);        
        });
    },

    // drag a csv file
    async onDrop(e){  
      e.preventDefault();
      this.initData();
      this.csvfile = e.dataTransfer.files[0];
      await this.previewCsv();
      this.fileloading = false;
    },

    // select a csv file
    async onSelect() {
      this.initData();
      this.csvfile = document.getElementById("files").files[0];
      if (this.csvfile){
         await this.previewCsv();
      }
      this.fileloading = false;
    },
   
    // preview csv data
    async previewCsv(){
      this.fileloading = true;

      let fileinfo = '';
      this.filesize = this.csvfile.size;
      if (this.filesize > 1000){
        fileinfo = Math.round(this.filesize /1000);
        fileinfo = "("+ fileinfo.toString().replace(/\d{1,3}(?=(\d{3})+$)/g,function(s){ return s+','}) + "K)"
      } else {
        fileinfo = "("+ this.filesize + ")B";
      }
      this.fileinfo = fileinfo;

      this.charset = await this.getEncoding(this.csvfile);
      console.log('this.charset:', this.charset);

      //const charset = 'utf8';
      //let config = {preview: 10, complete: this.fetchPreviewData, skipEmptyLines: true, encoding: charset, delimiter: this.delimiter}; 
      let config = {step: this.stepPreview, skipEmptyLines: true, encoding: this.charset, delimiter: this.delimiter}; 
      let prevData = Papa.parse(this.csvfile, config);
    },

    stepPreview(results, parser) {
      let data = results.data;
      if (this.rowcount === this.headlines - 1){
        this.columns.push({ prop: "col0", width: 120 ,label: "列名行"});
        for (let i=0; i< data.length; i++) {
            this.columns.push({ prop: "col"+ (i+1), width: 200 ,label: data[i]});
        }
      } else {
        let row = new Object();
        if (this.rowcount === this.attrlines - 1){
           row["col0"] = "属性行";
        }
        if (this.rowcount === this.datastart - 1){
           row["col0"] = "データ開始行";
        }       
        for (let i=0; i< data.length; i++) {
          let adj = data[i].length * 10;
          this.columns[i+1].width = adj > this.columns[i+1].width ? adj : this.columns[i+1].width;
          row["col"+ (i+1)] = data[i];
        }
        this.csvData.push(row);
      }

      this.rowcount = this.rowcount + 1;
      if (this.rowcount > 20){
        parser.abort();
      }
    },

    // // CSVプレビュー
    // fetchPreviewData(results)
    // {
    //   const data = results.data;
    //   this.columns.push({ prop: "col0", width: 120 ,label: "列名行"});
    //   if (this.headlines > 0){
    //     for (let i=0; i< data[this.headlines- 1].length; i++) {
    //         this.columns.push({ prop: "col"+ (i+1), width: 200 ,label: data[this.headlines- 1][i]});
    //     }
    //   } else {
    //      for (let i=0; i< data[0].length; i++) {
    //         this.columns.push({ prop: "col"+ (i+1), width: 200 ,label: "col"+ (i+1)});
    //     }
    //   }
    //   for (let j=1; j< data.length; j++){
    //     let row = new Object();
    //     for (let i=0; i< data[j].length; i++) {
    //        row["col"+ (i+1)] = data[j][i];
    //     }
    //     this.csvData.push(row);
    //   }
    //   if (this.attrlines > 0){
    //     this.csvData[this.attrlines- this.headlines - 1]["col0"] = "属性行";
    //   }  
    //   this.csvData[this.datastart - this.headlines - 1]["col0"] = "データ開始行";
    //   this.fileloading = false;
    // }, 

    // プロパティのリロード
    async reload(){
      this.columns = [];
      this.csvData = [];      
      await this.previewCsv();
    },

    // アップロード開始
    async upload(){
      await this.createTable();
      let config = { chunk: await this.prepareChunckData, 
                     complete: this.completeUpload, 
                     encoding: this.charset, 
                     skipEmptyLines: true,
                     delimiter: this.delimiter}; 
      Papa.LocalChunkSize = CHUNCK_SIZE; 
      // this.filesize = this.csvfile.size;
      this.markTime = new Date();
      this.startTime = new Date();
      this.hint = "start parse csvfile ...";
      let prevData = Papa.parse(this.csvfile, config);
    },

    // 表を作成
    async createTable(results){
      if (this.attrlines > 0){
        for (let i=1; i < this.columns.length; i++){
           this.dataTypes.push(this.csvData[this.attrlines - this.headlines - 1]["col" + i]);
        }
      } else {
        const dataLenth = this.csvData.length - (this.datastart - 2);
        const sniffDepth = (dataLenth < SNIFF_DEPTH ? dataLenth : SNIFF_DEPTH);

        for (let i=1; i < this.columns.length; i++){
          // collect sample
          let sample = [];
          for (let j= 0; j < sniffDepth; j++){
             let val = this.csvData[this.datastart - 2 + j]["col"+ i];
             if (val !== '' && val.toUpperCase() !== 'NULL'){
               sample.push(val);
             }
          }
          const type = this.guessDateType(sample);
          this.dataTypes.push(type);
        }
      }
      let columnDefs =[];
      for (let i=1; i< this.columns.length; i++) {
         columnDefs.push(this.columns[i].label + ' ' + this.dataTypes[i-1]);
      }
      //this.tableName = "hive.default.csv_imp_" + uuid().replace(/-/g,"");
      this.tableName = "hive.default.csv_from_" + (new Date()).toLocaleString().replace(/ /g,'').replace(/\//g,'').replace(/:/g,'');
      let createSql = "create table " + this.tableName + " (" + columnDefs.join(",") + ")";
      console.log(createSql);
      this.hint ="creating table" + this.tableName + " ...";

　　　 await this.executeSql(createSql); 
      this.fileinfo = this.fileinfo + "=>" + this.tableName;
    },

    guessDateType(sample)
    {
      // let sample = ['True','false'];
      for (let i=0; i< CHK_LIST.length; i++ ){
        if (sample.every(item =>  new RegExp(CHK_LIST[i].reg).test(item))) return CHK_LIST[i].type;
      }
      return "VARCHAR";
    },

    // チャンクでアップロード
    async prepareChunckData(results)
    {
      if (this.stopflg === true){
        return;
      }
      if (this.concount >= CONCURENT_MAX) {  
        this.pauseFlg = true;
        // parser.pause();
        return new Promise(resolve => {
          setTimeout(() => resolve(this.prepareChunckData(results)), 3000);
        });
      } else {
        if (!this.hasError){
          this.concount = this.concount + 1
          await this.postChunkData(results);
          if (this.pauseFlg == true){
            this.pauseFlg = false;
            // parser.resume();
          }
        }
      }
    },

    async postChunkData(results){
      this.hint = "Start:" + this.startTime.toLocaleString() + this.costTime + ": uploading chunk " + this.chunkNo + "/" + this.chunks;
      this.uploading = true;
      const data = results.data;
      let insertSql =  "insert into " + this.tableName + " values "
      let startRow = this.chunkNo == 0? this.datastart - 1: 0;
      for (let j=startRow; j< data.length; j++){
        let values = "(";

        for (let i=0; i< this.dataTypes.length; i++) {
           let val = data[j][i];
           if (val === ""){
              val = "NULL";
           } else {
              if (this.dataTypes[i].toUpperCase().startsWith("VARCHAR")){
                val = "\'" + data[j][i] + "\'";
              } else if (this.dataTypes[i].toUpperCase() === "DATE"){
                val = "date \'" + data[j][i] + "\'";
              } else if (this.dataTypes[i].toUpperCase() === "TIMESTAMP"){
                val = "timestamp \'" + data[j][i] + "\'";
              } 
           }
           values = values + val + (i == data[j].length - 1 ? ")": ",");
        }
        insertSql = insertSql + ((j == data.length - 1) ? values : (values + ","));
      } 

      // console.log(insertSql);
      await this.executeSql(insertSql);
      this.concount = this.concount - 1;

      // graph
      if (this.chunkNo % CONCURENT_MAX === 0) {
        let cost =  ((new Date()).getTime() - this.markTime.getTime()) /1000;
        this.chunkList.push(this.chunkNo);
        this.speedList.push(cost);
        this.drawChart();
        this.markTime=new Date();
      }

      this.chunkNo = this.chunkNo + 1;
      this.costTime = "(" +Math.round(((new Date()).getTime() - this.startTime.getTime()) /1000) + "s)";
      if (this.chunkNo === this.chunks){
        this.hint = this.hint + " (completed!) ";
      }
    },

    // アップロード完了
    completeUpload(results){
       //this.hint ="all readed, waiting upload ...";
    },

    // PRESTO API コール
    async executeSql(sqlStr) {
      const body = {
        querySql: this.$constants.SQL_PREFIX + sqlStr,
        areaCode: "L"
      };
      const res = await api.executeSyncPrestoQuery(body);
      if (res === undefined || (res.status != 200 && res.status != 201)){
        console.log("error sql: ", sqlStr);
        this.hind = this.hind + " error occured !!!";
        this.pauseFlg = true;
        this.stopflg = true;
      }
    },

    // async executeSql(sqlStr) {
    //   const body = {
    //     querySql: this.$constants.SQL_PREFIX + sqlStr,
    //     areaCode: "L"
    //   };
    //   const res = await api.executePrestoQuery(body);
    //   await this.getSqlResult(res.data.queryId);
    // },

    // async getSqlResult(queryId) {
    //   const res = await api.fetchPrestoQueryInfo({ queryId });
    //   if (res.data.status === 3) {
    //     return;
    //   } else if (res.data.status === 9) {
    //     this.hasError = true;
    //     this.hint =  new Date().toLocaleString() + ": " + this.tableName+"'s chunk " + this.chunkNo + "upload api error!";
    //     return this.$message({
    //       message: "API失敗しました。",
    //       type: "warning"
    //     });
    //   } else {
    //     return new Promise(resolve => {
    //       setTimeout(() => resolve(this.getSqlResult(queryId)), 3000);
    //     });
    //   }
    // },

    hideDialog() {
      // this.$emit("onIntelligenceDialog", false);
    },

    cancel() {
      this.stopflg = true;
      this.hint = this.hint + " ... canceled. "
    }
  },

  watch: {

   }   
};
</script>

<style scoped>
.el-row {
  margin-bottom: 10px;
}
.el-tabs {
  min-height: 360px;
}
.el-tab-pane-div{
  margin:20px;
}
.el-tab-canvas{
  width: 600px;
  height: 400px;
}
.drag-box{
  min-height:360px;
}
.hint-mark {
  font-size:20px;
  color:#409EFF
}
</style>