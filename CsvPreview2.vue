<template>
  <el-dialog
    :title="`CSVファイルのプロパティを設定してください`"
    :visible.sync="$props.dialogVisible"
    width="1200px" height="800px">
    <el-row class="fb fb-v-center">
      <el-col :span="10">
        <div>
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "列名行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark" title="列の名前が定義されている行の行数を入力します。"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="headlines" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(0~999、0は列名行なし)" }}</el-col>
        </el-row>
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "属性行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark" title="列のデータ属性が定義されている行の行数を入力します。"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="attrlines" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(0~999、0は属性行行なし)" }}</el-col>
        </el-row> 
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "データ開始行：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle  hint-mark" title="実データが開始する行の行数を入力します。"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="datastart" :maxlength="50"></el-input></el-col>
          <el-col :span="10">  {{ "(列名行と属性行以降の数字)" }}</el-col>
        </el-row> 
        <el-row class="fb fb-v-center">
          <el-col :span="6">{{ "区切り記号：" }}</el-col>
          <el-col :span="2"><i class="fas fa-question-circle hint-mark" title="データ同士を区切る記号です。"></i></el-col>
          <el-col :span="6" style="margin-left:-10px;margin-right:15px;"><el-input v-model="cutsign" :maxlength="50"></el-input></el-col>
          <el-col :span="10">{{ "(,や;等の記号。タプは\t)" }}</el-col>
        </el-row> 
        </div>
      </el-col>
      <el-col :span="14">
        <div v-show="curStage >= 0">
        <el-row v-for="(stage, idx) in stageList" :key="stage">
          <el-col :span="23" style="text-align: right; padding-right:5px;"> {{ stage }} </el-col>
          <el-col :span="1">
            <i class="fas fa-check" v-if="idx < curStage" style="color:green;"></i>
            <i class="fas fa-spinner faa-spin animated" v-if="idx == curStage" style="color:orange;"></i>&nbsp;
          </el-col>          
        </el-row>
        </div>
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
          <!-- <el-progress :percentage="uploadProgress" v-show="uploading"></el-progress>&nbsp; -->
          <el-progress :percentage="uploadProgress" v-show="curStage == 1"></el-progress>&nbsp;
       </el-col>     
       <el-col style="text-align: right;" :span="8">
       <el-button size="small" style="width:150px" @click="collect()">確定</el-button>
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
import moment from "moment";
const encoding = require('encoding-japanese');
const SNIFF_DEPTH = 10;

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
      stageList: ["一時表作成","プロード","ORC転換","一時表削除","ファイル削除"],
      rowcount:0,
      fileloading: false,
      csvfile: undefined,
      csvTableName: undefined,
      orcTableName: undefined,
      fileinfo: '',
      filesize: '',
      uploading: false,
      hasError: false,
      hint: '',
      headlines: 1,
      attrlines: 2,
      datastart: 3,
      cutsign: ",",
      columns: [],
      dataTypes: [],
      csvData: [],
      startTime: undefined,
      costTime:'',
      uploadProgress: 0,
      curStage: -1,
      s3api: undefined,
      s3key: undefined
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
    }  
  },
  
  methods: {
    initData(){
      this.rowcount =0;
      this.csvfile = undefined;
      this.csvTableName = undefined;
      this.filesize = 0;
      this.headlines = 1;
      this.attrlines = 2;
      this.datastart = 3;
      this.cutsign = ",";   
      this.columns = [];
      this.csvData = [];
      this.dataTypes = [];
     
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

    // プロパティのリロード
    async reload(){
      this.columns = [];
      this.csvData = [];      
      await this.previewCsv();
    },

    // プロセス開始
    async collect(){
      this.startTime = new Date();
      this.hint = "Started@" + moment().format('HH:mm:ss');
      // 1.  一時表作成
      this.curStage++;
      await this.createCsvTable();

      // 2. CSVファイルアプロード
      this.curStage++;
      const result = await api.fetchS3Connections();
      const amazonS3 = result.data.locations[0];
      console.log('amazonS3:', amazonS3);
      const aws = require("aws-sdk");
      aws.config.update({
        region: amazonS3.regionName,
        credentials: new aws.Credentials(amazonS3.accessKey, amazonS3.secretKey)
      });
      const bucket = amazonS3.bucketName;
      const s3 = new aws.S3({params: {Bucket: bucket}});
      const loc = "warehouse/" + this.csvTableName.substring(13) + "/" ;
      await this.upload(s3, bucket, loc + this.csvfile.name);

      // 3. データをORCに転換
      this.curStage++;
      let ret = await this.createOrcTable();
      if (ret == false){
        return;
      }

      // 4. 一時表削除
      this.curStage++;
      await this.deleteCsvTable();

      // 5. CSVファイル削除"
      this.curStage++;
      const params = {Bucket:bucket, Key: loc};
      let _that = this;
      s3.deleteObject(params, function(err, data) {
        if (err) {
           console.log(err, err.stack); // an error occurred
        } else {
          _that.curStage++;
          _that.stageList[4] = _that.stageList[4] + " (" + loc + ")";
          let costTime = "cost (" + Math.round(((new Date()).getTime() - _that.startTime.getTime()) /1000) + "s)";      
          _that.hint = _that.hint + ", finished@" + moment().format('HH:mm:ss') + costTime;
        }
      })

    },

    // 一時csv表作成
    async createCsvTable(){

      let columnVarchars =[];
      for (let i=1; i< this.columns.length; i++) {
         columnVarchars.push(this.columns[i].label + ' varchar');
      }
      this.csvTableName = "hive.default.csv_tmp_" + uuid().replace(/-/g,"");
      let createSql = "create table " + this.csvTableName + " (" + columnVarchars.join(",") + ") WITH (FORMAT = 'CSV', csv_escape = '\/',csv_quote = '\"',";
      createSql = createSql+ "csv_separator = ',',skip_header_line_count = 2,EXTERNAL_LOCATION = 's3a://lac-datalake/warehouse/" + this.csvTableName.substring(13) +"')";
      console.log(createSql);
      // this.hint ="creating table" + this.csvTableName + " ...";

　　　 await this.executeSql(createSql); 
      this.stageList[0] = this.stageList[0] + " (" + this.csvTableName + ")";
    },

    // 一時csv表削除
    async deleteCsvTable(){
      let sql = "drop table " + this.csvTableName;
      await this.executeSql(sql); 
      this.stageList[3] = this.stageList[3] + " (" + this.csvTableName + ")";
    },

    //CSVファイルアプロード
    async upload(s3, bucket, key){
      return new Promise((resolve, reject) => {
        const params = {Key: key,
                        ContentType: this.csvfile.type,
                        Body: this.csvfile
                      };
        this.uploading = true;
      
        let options = {partSize: 5 * 1024 * 1024, queueSize: 4};
        let _this = this;
        s3.upload(params, options, function(err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            reject(err.message);
          } else {
            console.log('upload:',data);
            _this.stageList[1] = _this.stageList[1] + " (" + data.Key + ")";
            resolve();
          }
        }).on('httpUploadProgress', function(evt) {
              _this.uploadProgress = parseInt((evt.loaded * 100) / evt.total);
        });
      })
    },

    // orcデータ表作成
    async createOrcTable(){
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
         if (this.dataTypes[i-1] == 'VARCHAR'){
            columnDefs.push(this.columns[i].label);
         } else {
            columnDefs.push('cast('+ this.columns[i].label + ' as ' + this.dataTypes[i-1] + ') ' + this.columns[i].label);
         }

      }
      this.orcTableName = "hive.default.csv_imp_" + (new Date()).toLocaleString().replace(/ /g,'').replace(/\//g,'').replace(/:/g,'');
      let createSql = "create table " + this.orcTableName + " WITH (format = 'ORC') AS select ";
      createSql = createSql+ columnDefs.join(",") + " from " + this.csvTableName;
      console.log(createSql);

      let ret = await this.executeSql(createSql); 
      this.stageList[2] = this.stageList[2] + " (" + this.orcTableName + ")" ;
      return ret;
    },

    guessDateType(sample)
    {
      // let sample = ['True','false'];
      for (let i=0; i< CHK_LIST.length; i++ ){
        if (sample.every(item =>  new RegExp(CHK_LIST[i].reg).test(item))) return CHK_LIST[i].type;
      }
      return "VARCHAR";
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
        this.hint = this.hint + " error occured !!!";
        return false;
      } else {
        return true;
      }
    },

    hideDialog() {
      // this.$emit("onIntelligenceDialog", false);
    },

    cancel() {
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